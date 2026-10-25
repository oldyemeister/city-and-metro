'use strict';
// Local non-commercial extension: named rail colors for playable real cities, researched 2026-10-25.
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
  // Reference colors for operational systems checked 2026-10-25; not future line proposals.
  const byMap = {
  "hz": [
    {
      "operator": "杭港地铁",
      "source": "https://en.wikipedia.org/wiki/Module:Adjacent_stations/Hangzhou_Metro",
      "entries": [
        {
          "name": "1号线",
          "code": "1",
          "color": "#DF4661",
          "aliases": "1號線 Line 1"
        },
        {
          "name": "5号线",
          "code": "5",
          "color": "#00AEC7",
          "aliases": "5號線 Line 5"
        }
      ]
    },
    {
      "operator": "杭州地铁",
      "source": "https://en.wikipedia.org/wiki/Module:Adjacent_stations/Hangzhou_Metro",
      "entries": [
        {
          "name": "2号线",
          "code": "2",
          "color": "#F1803A",
          "aliases": "2號線 Line 2"
        },
        {
          "name": "3号线",
          "code": "3",
          "color": "#FFCD00",
          "aliases": "3號線 Line 3"
        },
        {
          "name": "4号线",
          "code": "4",
          "color": "#6CC24A",
          "aliases": "4號線 Line 4"
        },
        {
          "name": "6号线",
          "code": "6",
          "color": "#0072CE",
          "aliases": "6號線 Line 6"
        },
        {
          "name": "7号线",
          "code": "7",
          "color": "#87189D",
          "aliases": "7號線 Line 7"
        },
        {
          "name": "8号线",
          "code": "8",
          "color": "#AC145A",
          "aliases": "8號線 Line 8"
        },
        {
          "name": "9号线",
          "code": "9",
          "color": "#BE4D00",
          "aliases": "9號線 Line 9"
        },
        {
          "name": "10号线",
          "code": "10",
          "color": "#DAAA00",
          "aliases": "10號線 Line 10"
        },
        {
          "name": "16号线",
          "code": "16",
          "color": "#FFB25B",
          "aliases": "16號線 Line 16"
        },
        {
          "name": "19号线",
          "code": "19",
          "color": "#05C3DD",
          "aliases": "19號線 Line 19"
        }
      ]
    },
    {
      "operator": "浙江轨道集团",
      "source": "https://en.wikipedia.org/wiki/Module:Adjacent_stations/Hangzhou_Metro",
      "entries": [
        {
          "name": "杭海城际",
          "code": "HH",
          "color": "#0077C8",
          "aliases": "杭海城際 Hanghai Hangzhou Haining"
        }
      ]
    }
  ],
  "gz": [
    {
      "operator": "广州地铁",
      "source": "https://en.wikipedia.org/wiki/Module:Adjacent_stations/Guangzhou_Metro",
      "entries": [
        {
          "name": "1号线",
          "code": "1",
          "color": "#F3D03E",
          "aliases": "1號線 Line 1"
        },
        {
          "name": "2号线",
          "code": "2",
          "color": "#00629B",
          "aliases": "2號線 Line 2"
        },
        {
          "name": "3号线",
          "code": "3",
          "color": "#ECA154",
          "aliases": "3號線 Line 3"
        },
        {
          "name": "4号线",
          "code": "4",
          "color": "#00843D",
          "aliases": "4號線 Line 4"
        },
        {
          "name": "5号线",
          "code": "5",
          "color": "#C5003E",
          "aliases": "5號線 Line 5"
        },
        {
          "name": "6号线",
          "code": "6",
          "color": "#80225F",
          "aliases": "6號線 Line 6"
        },
        {
          "name": "7号线",
          "code": "7",
          "color": "#97D700",
          "aliases": "7號線 Line 7"
        },
        {
          "name": "8号线",
          "code": "8",
          "color": "#008C95",
          "aliases": "8號線 Line 8"
        },
        {
          "name": "9号线",
          "code": "9",
          "color": "#71CC98",
          "aliases": "9號線 Line 9"
        },
        {
          "name": "10号线",
          "code": "10",
          "color": "#7389B2",
          "aliases": "10號線 Line 10"
        },
        {
          "name": "11号线",
          "code": "11",
          "color": "#FFB40C",
          "aliases": "11號線 Line 11"
        },
        {
          "name": "12号线",
          "code": "12",
          "color": "#505D12",
          "aliases": "12號線 Line 12"
        },
        {
          "name": "13号线",
          "code": "13",
          "color": "#8E8C13",
          "aliases": "13號線 Line 13"
        },
        {
          "name": "14号线",
          "code": "14",
          "color": "#81312F",
          "aliases": "14號線 Line 14"
        },
        {
          "name": "18号线",
          "code": "18",
          "color": "#0047BA",
          "aliases": "18號線 Line 18"
        },
        {
          "name": "21号线",
          "code": "21",
          "color": "#201747",
          "aliases": "21號線 Line 21"
        },
        {
          "name": "22号线",
          "code": "22",
          "color": "#CD5228",
          "aliases": "22號線 Line 22"
        },
        {
          "name": "广佛线",
          "code": "GF",
          "color": "#C4D600",
          "aliases": "廣佛線 Guangfo Foshan"
        },
        {
          "name": "珠江新城旅客自动输送系统",
          "code": "APM",
          "color": "#00B5E2",
          "aliases": "珠江新城旅客自動輸送系統 自动旅客捷运 自動旅客捷運 APM Zhujiang New Town"
        }
      ]
    },
    {
      "operator": "佛山地铁",
      "source": "https://en.wikipedia.org/wiki/Module:Adjacent_stations/Foshan_Metro",
      "entries": [
        {
          "name": "佛山2号线",
          "code": "2",
          "color": "#F5333F",
          "aliases": "2號線 Line 2"
        },
        {
          "name": "佛山3号线",
          "code": "3",
          "color": "#004DB3",
          "aliases": "3號線 Line 3"
        }
      ]
    }
  ],
  "hk": [
    {
      "operator": "港鐵 MTR",
      "source": "https://en.wikipedia.org/wiki/Module:Adjacent_stations/MTR",
      "entries": [
        {
          "name": "觀塘綫",
          "code": "KTL",
          "color": "#00AB4E",
          "aliases": "观塘线 Kwun Tong"
        },
        {
          "name": "荃灣綫",
          "code": "TWL",
          "color": "#ED1D24",
          "aliases": "荃湾线 Tsuen Wan"
        },
        {
          "name": "港島綫",
          "code": "ISL",
          "color": "#007DC5",
          "aliases": "港岛线 Island"
        },
        {
          "name": "將軍澳綫",
          "code": "TKL",
          "color": "#7D499D",
          "aliases": "将军澳线 Tseung Kwan O"
        },
        {
          "name": "東涌綫",
          "code": "TCL",
          "color": "#F7943E",
          "aliases": "东涌线 Tung Chung"
        },
        {
          "name": "東鐵綫",
          "code": "EAL",
          "color": "#53B7E8",
          "aliases": "东铁线 East Rail"
        },
        {
          "name": "屯馬綫",
          "code": "TML",
          "color": "#923011",
          "aliases": "屯马线 Tuen Ma"
        },
        {
          "name": "南港島綫",
          "code": "SIL",
          "color": "#BAC429",
          "aliases": "南港岛线 South Island"
        },
        {
          "name": "機場快綫",
          "code": "AEL",
          "color": "#00888A",
          "aliases": "机场快线 Airport Express"
        },
        {
          "name": "迪士尼綫",
          "code": "DRL",
          "color": "#F173AC",
          "aliases": "迪士尼线 Disneyland Resort"
        },
        {
          "name": "輕鐵（系統代表色）",
          "code": "LR",
          "color": "#D3A809",
          "aliases": "轻铁 系统代表色 Light Rail"
        }
      ]
    }
  ],
  "tp": [
    {
      "operator": "臺北捷運",
      "source": "https://en.wikipedia.org/wiki/Module:Adjacent_stations/Taipei_Metro",
      "entries": [
        {
          "name": "文湖線",
          "code": "BR",
          "color": "#C48C31",
          "aliases": "文湖线 Wenhu Brown"
        },
        {
          "name": "淡水信義線",
          "code": "R",
          "color": "#E3002C",
          "aliases": "淡水信义线 Tamsui Xinyi Red"
        },
        {
          "name": "松山新店線",
          "code": "G",
          "color": "#008659",
          "aliases": "松山新店线 Songshan Xindian Green"
        },
        {
          "name": "中和新蘆線",
          "code": "O",
          "color": "#F8B61C",
          "aliases": "中和新芦线 Zhonghe Xinlu Orange"
        },
        {
          "name": "板南線",
          "code": "BL",
          "color": "#0070BD",
          "aliases": "板南线 Bannan Blue"
        },
        {
          "name": "新北投支線",
          "code": "R22A",
          "color": "#FD92A3",
          "aliases": "新北投支线 Xinbeitou"
        },
        {
          "name": "小碧潭支線",
          "code": "G03A",
          "color": "#CFDB00",
          "aliases": "小碧潭支线 Xiaobitan"
        }
      ]
    },
    {
      "operator": "新北捷運",
      "source": "https://en.wikipedia.org/wiki/Module:Adjacent_stations/New_Taipei_Metro",
      "entries": [
        {
          "name": "環狀線",
          "code": "Y",
          "color": "#FFDB00",
          "aliases": "环状线 Circular"
        },
        {
          "name": "淡海輕軌",
          "code": "V",
          "color": "#E5554F",
          "aliases": "淡海轻轨 Danhai"
        },
        {
          "name": "安坑輕軌",
          "code": "K",
          "color": "#C3B091",
          "aliases": "安坑轻轨 Ankeng"
        },
        {
          "name": "三鶯線",
          "code": "LB",
          "color": "#79BCE8",
          "aliases": "三莺线 Sanying"
        }
      ]
    },
    {
      "operator": "桃園捷運",
      "source": "https://en.wikipedia.org/wiki/Module:Adjacent_stations/Taoyuan_Metro",
      "entries": [
        {
          "name": "機場捷運",
          "code": "A",
          "color": "#8246AF",
          "aliases": "机场捷运 桃园机场 Taoyuan Airport"
        }
      ]
    }
  ]
};
  byMap.tk = groups;
  const originalTokyo = ['銀座線', '丸ノ内線', '日比谷線', '東西線', '千代田線', '有楽町線', '半蔵門線', '南北線', '副都心線', '浅草線', '三田線', '新宿線', '大江戸線'];
  const normalize = function (s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/綫/g, '线').replace(/線/g, '线').replace(/號/g, '号').replace(/鐵/g, '铁').replace(/捷運/g, '捷运').replace(/臺/g, '台').replace(/園/g, '园').replace(/廣/g, '广').replace(/\s+/g, ''); };
  CM.LineColors = {
    groups: groups,
    byMap: byMap,
    forMap: function (id, colors) {
      // Named real-world presets replace duplicate legacy rows; existing saved HEX is untouched.
      if (byMap[id]) return byMap[id];
      const original = { operator: '原版配色', entries: colors.map(function (color, i) {
        return { name: '颜色 ' + (i + 1), code: String(i + 1), color: color.toUpperCase(), aliases: '' };
      }) };
      return [original];
    },
    currentLabel: function (id, colors, color) {
      const hex = color.toUpperCase(), names = [];
      for (const group of this.forMap(id, colors)) for (const entry of group.entries) {
        if (entry.color === hex) names.push((entry.operator || group.operator) + ' · ' + entry.name);
      }
      if (names.length) return names.join(' / ') + ' · ' + hex;
      const i = colors.findIndex(function (c) { return c.toUpperCase() === hex; });
      if (id === 'tk' && i >= 0 && originalTokyo[i]) return (i < 9 ? '東京メトロ' : '都営地下鉄') + ' · ' + originalTokyo[i] + '（原版配色） · ' + hex;
      return (i >= 0 ? '原版配色 · ' : '自定义颜色 · ') + hex;
    },
    label: function (group, entry) { return (entry.operator || group.operator) + ' · ' + entry.name + ' · ' + entry.color.toUpperCase(); },
    matches: function (group, entry, query) {
      return normalize([group.operator, entry.operator, entry.name, entry.code, entry.color, entry.aliases].join(' ')).includes(normalize(query));
    },
    parseHex: function (value) {
      const match = /^#?([0-9a-f]{6})$/i.exec(String(value).trim());
      return match ? '#' + match[1].toUpperCase() : null;
    },
    toHSV: function (hex, fallbackHue) {
      const rgb = hex.slice(1).match(/../g).map(function (c) { return parseInt(c, 16) / 255; });
      const r = rgb[0], g = rgb[1], b = rgb[2], max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
      let hue = fallbackHue || 0;
      if (delta) {
        hue = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
        hue = ((hue * 60) + 360) % 360;
      }
      return { h: hue, s: max ? delta / max * 100 : 0, v: max * 100 };
    },
    fromHSV: function (hue, saturation, brightness) {
      const h = ((hue % 360) + 360) % 360 / 60;
      const s = Math.min(100, Math.max(0, saturation)) / 100, v = Math.min(100, Math.max(0, brightness)) / 100;
      const c = v * s, x = c * (1 - Math.abs(h % 2 - 1)), m = v - c;
      const rgb = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
      return '#' + rgb.map(function (n) { return Math.round((n + m) * 255).toString(16).padStart(2, '0'); }).join('').toUpperCase();
    },
    ink: function (hex) {
      const v = hex.slice(1).match(/../g).map(function (c) { const s = parseInt(c, 16) / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] > 0.179 ? '#000000' : '#ffffff';
    },
  };
})(window.CM);
