// Offline, fixed-capture benchmark. The JS driver supplies typed arrays from the pinned fixture only.
#include <node_api.h>
#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <utility>

template <class T> struct Array {
  T* p;
  size_t size;
  T& operator[](int i) const { return p[i]; }
};

template <class T>
Array<T> field(napi_env env, napi_value obj, const char* name) {
  napi_value view, buffer;
  napi_typedarray_type type;
  void* data;
  size_t size, offset;
  if (napi_get_named_property(env, obj, name, &view) != napi_ok ||
      napi_get_typedarray_info(env, view, &type, &size, &data, &buffer, &offset) != napi_ok) std::abort();
  return {static_cast<T*>(data), size};
}

struct Heap {
  Array<double> keys;
  Array<int> nodes;
  int count = 0;

  void push(double key, int node) {
    int i = count++;
    while (i > 0) {
      int parent = (i - 1) >> 1;
      if (keys[parent] <= key) break;
      keys[i] = keys[parent];
      nodes[i] = nodes[parent];
      i = parent;
    }
    keys[i] = key;
    nodes[i] = node;
  }

  std::pair<double, int> pop() {
    const auto top = std::make_pair(keys[0], nodes[0]);
    if (--count > 0) {
      const double lastKey = keys[count];
      const int lastNode = nodes[count];
      int i = 0;
      while (true) {
        const int left = 2 * i + 1;
        if (left >= count) break;
        const int right = left + 1;
        const int child = right < count && keys[right] < keys[left] ? right : left;
        if (keys[child] >= lastKey) break;
        keys[i] = keys[child];
        nodes[i] = nodes[child];
        i = child;
      }
      keys[i] = lastKey;
      nodes[i] = lastNode;
    }
    return top;
  }
};

struct Search {
  Array<int> outStart, outArc, arcTo, arcFrom, start, nodes;
  Array<double> times, km, arcKm;
  Array<float> time;
  Array<int> pS, pD;
  Array<float> dem;
  Array<double> dist, acc;
  Array<float> dkm, resultT, resultK;
  Array<int> pred, order, mark;
  Heap heap;
  static constexpr double inf = 1e30;

  int tree(int o, int need, int stamp) {
    std::fill(dist.p, dist.p + dist.size, inf);
    heap.count = 0;
    for (int k = start[o]; k < start[o + 1]; ++k) {
      const int v = nodes[k];
      if (times[k] < dist[v]) {
        dist[v] = times[k];
        dkm[v] = static_cast<float>(km[k]);
        pred[v] = -1;
        heap.push(times[k], v);
      }
    }
    int n = 0;
    while (heap.count) {
      const auto [du, u] = heap.pop();
      if (du > dist[u]) continue;
      order[n++] = u;
      if (need > 0 && mark[u] == stamp && --need == 0) break;
      for (int k = outStart[u]; k < outStart[u + 1]; ++k) {
        const int a = outArc[k], v = arcTo[a];
        const double nd = du + time[a];
        if (nd < dist[v]) {
          dist[v] = nd;
          dkm[v] = static_cast<float>(static_cast<double>(dkm[u]) + arcKm[a]);
          pred[v] = a;
          heap.push(nd, v);
        }
      }
    }
    return n;
  }

  void row(int o, int stamp, float* flow) {
    int need = 0;
    for (int q = pS[o]; q < pS[o + 1]; ++q) {
      const int d = pD[q];
      if (d == o) continue;
      for (int k = start[d]; k < start[d + 1]; ++k) {
        const int node = nodes[k];
        if (mark[node] != stamp) { mark[node] = stamp; ++need; }
      }
    }
    const int n = need > 0 ? tree(o, need, stamp) : 0;
    for (int q = pS[o]; q < pS[o + 1]; ++q) {
      const int d = pD[q];
      if (d == o) continue;
      double best = inf, bestKm = 0;
      int winner = -1;
      for (int k = start[d]; k < start[d + 1]; ++k) {
        const int node = nodes[k];
        const double v = dist[node] + times[k];
        if (v < best) { best = v; bestKm = static_cast<double>(dkm[node]) + km[k]; winner = node; }
      }
      if (winner < 0 || best >= inf) continue;
      resultT[q] = static_cast<float>(best);
      resultK[q] = static_cast<float>(bestKm);
      if (dem[q] > 0) acc[winner] += dem[q];
    }
    for (int i = n - 1; i >= 0; --i) {
      const int u = order[i];
      const double a = acc[u];
      if (a > 0) {
        const int e = pred[u];
        if (e >= 0) { flow[e] = static_cast<float>(static_cast<double>(flow[e]) + a); acc[arcFrom[e]] += a; }
        acc[u] = 0;
      }
    }
  }
};

napi_value allocation(napi_env env, napi_callback_info call) {
  size_t argc = 1;
  napi_value obj, undefined;
  if (napi_get_cb_info(env, call, &argc, &obj, nullptr, nullptr) != napi_ok || argc != 1) std::abort();
  const auto I = [&](const char* name){ return field<int>(env, obj, name); };
  const auto D = [&](const char* name){ return field<double>(env, obj, name); };
  const auto F = [&](const char* name){ return field<float>(env, obj, name); };
  Search s{I("outStart"),I("outArc"),I("arcTo"),I("arcFrom"),I("start"),I("nodes"),
           D("times"),D("km"),D("arcKm"),F("time"),I("pS"),I("pD"),F("dem"),D("dist"),D("accN"),
           F("dkm"),F("T"),F("K"),I("pred"),I("order"),I("mark"),{D("heapK"),I("heapV")}};
  const auto origins = I("origins");
  const auto blocks = F("blocks"), sum = F("sum");
  for (int b = 0; b < 32; ++b) {
    float* flow = blocks.p + b * sum.size;
    for (int i = b * origins.size / 32; i < static_cast<int>((b+1)*origins.size/32); ++i)
      s.row(origins[i], i+1, flow);
    for (int a = 0; a < static_cast<int>(sum.size); ++a) sum[a] += flow[a];
  }
  napi_get_undefined(env, &undefined);
  return undefined;
}

NAPI_MODULE_INIT() {
  napi_value func;
  napi_create_function(env, "allocation", NAPI_AUTO_LENGTH, allocation, nullptr, &func);
  return func;
}
