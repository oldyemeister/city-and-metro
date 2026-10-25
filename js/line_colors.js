'use strict';
// Local non-commercial extension: named Tokyo rail colors, researched 2026-10-25.
// Numeric color facts are referenced per operator; see updates_oldyemeister.md.
// Palette metadata is UI-only. Saved line.color remains a hexadecimal string.
(function (CM) {
  const groups = [
  {
    "operator": "東京メトロ",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Tokyo%20Metro",
    "entries": [
      {
        "name": "銀座線",
        "code": "G",
        "color": "#FF9500",
        "aliases": "银座线 Ginza"
      },
      {
        "name": "丸ノ内線",
        "code": "M",
        "color": "#F62E36",
        "aliases": "丸之内线 丸之內線 丸之内 Marunouchi"
      },
      {
        "name": "日比谷線",
        "code": "H",
        "color": "#B5B5AC",
        "aliases": "日比谷线 Hibiya"
      },
      {
        "name": "東西線",
        "code": "T",
        "color": "#009BBF",
        "aliases": "东西线 Tozai"
      },
      {
        "name": "千代田線",
        "code": "C",
        "color": "#00BB85",
        "aliases": "千代田线 Chiyoda"
      },
      {
        "name": "有楽町線",
        "code": "Y",
        "color": "#C1A470",
        "aliases": "有乐町线 有樂町 Yurakucho"
      },
      {
        "name": "半蔵門線",
        "code": "Z",
        "color": "#8F76D6",
        "aliases": "半藏门线 半藏門 Hanzomon"
      },
      {
        "name": "南北線",
        "code": "N",
        "color": "#00AC9B",
        "aliases": "南北线 Namboku"
      },
      {
        "name": "副都心線",
        "code": "F",
        "color": "#9C5E31",
        "aliases": "副都心线 Fukutoshin"
      }
    ]
  },
  {
    "operator": "都営地下鉄",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Toei%20Subway",
    "entries": [
      {
        "name": "浅草線",
        "code": "A",
        "color": "#EC6E65",
        "aliases": "浅草线 Asakusa"
      },
      {
        "name": "三田線",
        "code": "I",
        "color": "#006CB6",
        "aliases": "三田线 Mita"
      },
      {
        "name": "新宿線",
        "code": "S",
        "color": "#B0C124",
        "aliases": "新宿线 Shinjuku"
      },
      {
        "name": "大江戸線",
        "code": "E",
        "color": "#CE045B",
        "aliases": "大江户线 大江戶 Oedo"
      }
    ]
  },
  {
    "operator": "JR東日本",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/JR%20East",
    "entries": [
      {
        "name": "山手線",
        "code": "JY",
        "color": "#B1CB39",
        "aliases": "山手线 Yamanote"
      },
      {
        "name": "京浜東北線",
        "code": "JK",
        "color": "#1DAED1",
        "aliases": "京滨东北线 京濱東北 Keihin Tohoku"
      },
      {
        "name": "中央線快速",
        "code": "JC",
        "color": "#DD6935",
        "aliases": "中央线快速 Chuo Rapid"
      },
      {
        "name": "中央・総武線各駅停車",
        "code": "JB",
        "color": "#F2D01F",
        "aliases": "中央总武线 总武线 中央總武 Sobu Local"
      },
      {
        "name": "横須賀線",
        "code": "JO",
        "color": "#1069B4",
        "aliases": "横须贺线 Yokosuka"
      },
      {
        "name": "総武線快速",
        "code": "JO",
        "color": "#000080",
        "aliases": "总武线快速 總武 Sobu Rapid"
      },
      {
        "name": "埼京線",
        "code": "JA",
        "color": "#14A676",
        "aliases": "埼京线 Saikyo"
      },
      {
        "name": "湘南新宿ライン",
        "code": "JS",
        "color": "#DB2027",
        "aliases": "湘南新宿线 Shonan Shinjuku"
      },
      {
        "name": "常磐線快速",
        "code": "JJ",
        "color": "#1DAF7E",
        "aliases": "常磐线快速 Joban Rapid"
      },
      {
        "name": "常磐線各駅停車",
        "code": "JL",
        "color": "#868587",
        "aliases": "常磐线各站停车 Joban Local"
      },
      {
        "name": "京葉線",
        "code": "JE",
        "color": "#D01827",
        "aliases": "京叶线 Keiyo"
      },
      {
        "name": "武蔵野線",
        "code": "JM",
        "color": "#EB5A28",
        "aliases": "武藏野线 武藏野 Musashino"
      },
      {
        "name": "南武線",
        "code": "JN",
        "color": "#F2D01F",
        "aliases": "南武线 Nambu"
      },
      {
        "name": "横浜線",
        "code": "JH",
        "color": "#B1CB39",
        "aliases": "横滨线 橫濱 Yokohama"
      },
      {
        "name": "青梅線",
        "code": "JC",
        "color": "#DD6935",
        "aliases": "青梅线 Ome"
      },
      {
        "name": "五日市線",
        "code": "JC",
        "color": "#DD6935",
        "aliases": "五日市线 Itsukaichi"
      },
      {
        "name": "八高線",
        "code": "八高",
        "color": "#A09D94",
        "aliases": "八高线 Hachiko"
      },
      {
        "name": "中央本線",
        "code": "CO",
        "color": "#0074BE",
        "aliases": "中央本线 Chuo Main"
      },
      {
        "name": "東海道線",
        "code": "JT",
        "color": "#F0862B",
        "aliases": "东海道线 Tokaido"
      },
      {
        "name": "宇都宮線",
        "code": "JU",
        "color": "#F18E41",
        "aliases": "宇都宫线 Utsunomiya"
      },
      {
        "name": "高崎線",
        "code": "JU",
        "color": "#F18E41",
        "aliases": "高崎线 Takasaki"
      }
    ]
  },
  {
    "operator": "東急電鉄",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Tokyu",
    "entries": [
      {
        "name": "東横線",
        "code": "TY",
        "color": "#DA0442",
        "aliases": "东横线 东急 Tokyu Toyoko"
      },
      {
        "name": "目黒線",
        "code": "MG",
        "color": "#009BD8",
        "aliases": "目黑线 东急 Tokyu Meguro"
      },
      {
        "name": "田園都市線",
        "code": "DT",
        "color": "#20A288",
        "aliases": "田园都市线 东急 Tokyu Denentoshi"
      },
      {
        "name": "大井町線",
        "code": "OM",
        "color": "#F18C43",
        "aliases": "大井町线 东急 Tokyu Oimachi"
      },
      {
        "name": "池上線",
        "code": "IK",
        "color": "#EE86A7",
        "aliases": "池上线 东急 Tokyu Ikegami"
      },
      {
        "name": "東急多摩川線",
        "code": "TM",
        "color": "#AE0378",
        "aliases": "东急多摩川线 Tokyu Tamagawa"
      },
      {
        "name": "世田谷線",
        "code": "SG",
        "color": "#FCC70D",
        "aliases": "世田谷线 东急 Tokyu Setagaya"
      }
    ]
  },
  {
    "operator": "京王電鉄",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Keio",
    "entries": [
      {
        "name": "京王線",
        "code": "KO",
        "color": "#E7007E",
        "aliases": "京王线 Keio"
      },
      {
        "name": "京王新線",
        "code": "KO",
        "color": "#E7007E",
        "aliases": "京王新线 Keio New"
      },
      {
        "name": "井の頭線",
        "code": "IN",
        "color": "#1A417B",
        "aliases": "井之头线 井之頭 Inokashira"
      },
      {
        "name": "相模原線",
        "code": "KO",
        "color": "#E7007E",
        "aliases": "相模原线 Sagamihara"
      },
      {
        "name": "高尾線",
        "code": "KO",
        "color": "#E7007E",
        "aliases": "高尾线 Takao"
      },
      {
        "name": "動物園線",
        "code": "KO",
        "color": "#E7007E",
        "aliases": "动物园线 Dobutsuen"
      },
      {
        "name": "競馬場線",
        "code": "KO",
        "color": "#E7007E",
        "aliases": "竞马场线 Keibajo"
      }
    ]
  },
  {
    "operator": "小田急電鉄",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Odakyu",
    "entries": [
      {
        "name": "小田原線",
        "code": "OH",
        "color": "#0583C8",
        "aliases": "小田原线 小田急 Odakyu Odawara"
      },
      {
        "name": "多摩線",
        "code": "OT",
        "color": "#0583C8",
        "aliases": "多摩线 小田急 Odakyu Tama"
      }
    ]
  },
  {
    "operator": "西武鉄道",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Seibu%20Railway",
    "entries": [
      {
        "name": "池袋線",
        "code": "SI",
        "color": "#ED772D",
        "aliases": "池袋线 Seibu Ikebukuro"
      },
      {
        "name": "豊島線",
        "code": "SI",
        "color": "#ED772D",
        "aliases": "丰岛线 Seibu Toshima"
      },
      {
        "name": "西武有楽町線",
        "code": "SI",
        "color": "#ED772D",
        "aliases": "西武有乐町线 Seibu Yurakucho"
      },
      {
        "name": "西武新宿線",
        "code": "SS",
        "color": "#00A6BF",
        "aliases": "西武新宿线 Seibu Shinjuku"
      },
      {
        "name": "拝島線",
        "code": "SS",
        "color": "#00A6BF",
        "aliases": "拜岛线 Seibu Haijima"
      },
      {
        "name": "国分寺線",
        "code": "SK",
        "color": "#34B559",
        "aliases": "国分寺线 國分寺 Kokubunji"
      },
      {
        "name": "西武園線",
        "code": "SK",
        "color": "#34B559",
        "aliases": "西武园线 Seibuen"
      },
      {
        "name": "多摩湖線",
        "code": "ST",
        "color": "#FFB000",
        "aliases": "多摩湖线 Tamako"
      },
      {
        "name": "西武多摩川線",
        "code": "SW",
        "color": "#FD7400",
        "aliases": "西武多摩川线 Seibu Tamagawa"
      },
      {
        "name": "山口線",
        "code": "SY",
        "color": "#EF473D",
        "aliases": "山口线 Yamaguchi"
      }
    ]
  },
  {
    "operator": "東武鉄道",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Tobu",
    "entries": [
      {
        "name": "東武スカイツリーライン",
        "code": "TS",
        "color": "#006CBA",
        "aliases": "东武晴空塔线 伊势崎线 Tobu Skytree"
      },
      {
        "name": "亀戸線",
        "code": "TS",
        "color": "#006CBA",
        "aliases": "龟户线 龜戶 Kameido"
      },
      {
        "name": "大師線",
        "code": "TS",
        "color": "#006CBA",
        "aliases": "大师线 Daishi"
      },
      {
        "name": "東上線",
        "code": "TJ",
        "color": "#00428E",
        "aliases": "东上线 Tobu Tojo"
      }
    ]
  },
  {
    "operator": "京成電鉄",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Keisei%20Electric%20Railway",
    "entries": [
      {
        "name": "京成本線",
        "code": "KS",
        "color": "#011A68",
        "aliases": "京成本线 Keisei Main"
      },
      {
        "name": "押上線",
        "code": "KS",
        "color": "#011A68",
        "aliases": "押上线 Oshiage"
      },
      {
        "name": "金町線",
        "code": "KS",
        "color": "#011A68",
        "aliases": "金町线 Kanamachi"
      },
      {
        "name": "成田スカイアクセス線",
        "code": "KS",
        "color": "#EE7A00",
        "aliases": "成田机场线 成田空港线 Keisei Narita Sky Access"
      }
    ]
  },
  {
    "operator": "京急電鉄",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Keikyu",
    "entries": [
      {
        "name": "京急本線",
        "code": "KK",
        "color": "#00BFFF",
        "aliases": "京急本线 Keikyu Main"
      },
      {
        "name": "空港線",
        "code": "KK",
        "color": "#00BFFF",
        "aliases": "机场线 空港线 Keikyu Airport"
      }
    ]
  },
  {
    "operator": "東京都交通局",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Toei",
    "entries": [
      {
        "name": "日暮里・舎人ライナー",
        "code": "NT",
        "color": "#E43081",
        "aliases": "日暮里舍人线 日暮里舎人 Nippori Toneri"
      },
      {
        "name": "都電荒川線",
        "code": "SA",
        "color": "#E43081",
        "aliases": "都电荒川线 东京樱花电车 Toden Arakawa"
      }
    ]
  },
  {
    "operator": "東京モノレール",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Tokyo%20Monorail",
    "entries": [
      {
        "name": "羽田空港線",
        "code": "MO",
        "color": "#022B8B",
        "aliases": "东京单轨 东京单轨电车 羽田机场线 Tokyo Monorail"
      }
    ]
  },
  {
    "operator": "ゆりかもめ",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Yurikamome",
    "entries": [
      {
        "name": "東京臨海新交通臨海線",
        "code": "U",
        "color": "#0065A6",
        "aliases": "百合海鸥线 百合海鸥号 东京临海新交通 Yurikamome"
      }
    ]
  },
  {
    "operator": "首都圏新都市鉄道",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Tsukuba%20Express",
    "entries": [
      {
        "name": "つくばエクスプレス",
        "code": "TX",
        "color": "#17008A",
        "aliases": "筑波快线 筑波快線 Tsukuba Express"
      }
    ]
  },
  {
    "operator": "埼玉高速鉄道",
    "source": "https://en.wikipedia.org/wiki/Module:Adjacent%20stations/Saitama",
    "entries": [
      {
        "name": "埼玉スタジアム線",
        "code": "SR",
        "color": "#3658A8",
        "aliases": "埼玉高速铁道线 埼玉球场线 Saitama Stadium"
      }
    ]
  },
  {
    "operator": "東京臨海高速鉄道",
    "source": "https://en.wikipedia.org/wiki/Rinkai_Line",
    "entries": [
      {
        "name": "りんかい線",
        "code": "R",
        "color": "#00B48D",
        "aliases": "临海线 臨海線 Rinkai"
      }
    ]
  }
];
  const originalTokyo = ['銀座線', '丸ノ内線', '日比谷線', '東西線', '千代田線', '有楽町線', '半蔵門線', '南北線', '副都心線', '浅草線', '三田線', '新宿線', '大江戸線'];
  const normalize = function (s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ''); };
  CM.LineColors = {
    groups: groups,
    forMap: function (id, colors) {
      // Tokyo's old 13 presets represent the same lines as the first two groups.
      // Hide that duplicate row without changing defaults or saved color strings.
      if (id === 'tk') return groups;
      const original = { operator: '原版配色', entries: colors.map(function (color, i) {
        return { name: '颜色 ' + (i + 1), code: String(i + 1), color: color.toUpperCase(), aliases: '' };
      }) };
      return [original].concat(groups);
    },
    currentLabel: function (id, colors, color) {
      const hex = color.toUpperCase(), names = [];
      for (const group of this.forMap(id, colors)) for (const entry of group.entries) {
        if (entry.color === hex) names.push((entry.operator || group.operator) + ' · ' + entry.name);
      }
      if (names.length) return names.join(' / ') + ' · ' + hex;
      const i = colors.findIndex(function (c) { return c.toUpperCase() === hex; });
      if (id === 'tk' && i >= 0 && originalTokyo[i]) return (i < 9 ? '東京メトロ' : '都営地下鉄') + ' · ' + originalTokyo[i] + '（原版配色） · ' + hex;
      return '自定义颜色 · ' + hex;
    },
    label: function (group, entry) { return (entry.operator || group.operator) + ' · ' + entry.name + ' · ' + entry.color.toUpperCase(); },
    matches: function (group, entry, query) {
      return normalize([group.operator, entry.name, entry.code, entry.color, entry.aliases].join(' ')).includes(normalize(query));
    },
    ink: function (hex) {
      const v = hex.slice(1).match(/../g).map(function (c) { const s = parseInt(c, 16) / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] > 0.179 ? '#000000' : '#ffffff';
    },
  };
})(window.CM);
