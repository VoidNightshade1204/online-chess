function code2ToArray(str: string) {
  const array = [];
  for (let i = 0; i < str.length; i += 2) {
    array.push(str.substring(i, i + 2));
  }
  return array;
}

function csvToArray(csv: string) {
  return csv.split(',');
}

const emojiMap = {
  // 黄脸
  yellowFace: code2ToArray('😁😂😃😄👿😉😊☺️😌😍😏😒😓😔😖😘😚😜😝😞😠😡😢😣😥😨😪😭😰😱😲😳😷🙃😋😗😛🤑🤓😎🤗🙄🤔😩😤🤐🤒😴😀😆😅😇🙂😙😟😕🙁☹️😫😶😐😑😯😦😧😮😵😬🤕😈👻🥺🥴🤣🥰🤩🤤🤫🤪🧐🤬🤧🤭🤠🤯🤥🥳🤨🤢🤡🤮🥵🥶💩☠️💀👽👾👺👹🤖'),
  // 动物
  animal: code2ToArray('🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐽🐸🐵🙊🙉🙈🐒😺😸😹😻😼😽🙀😿😾🐔🐧🐦🐤🐣🐥🦆🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞🐜🦟🦗🕷️🕸️🦂🐢🐉🐍🦎'),
  // 食物
  food: csvToArray('🍅,🍆,🍉,🍊,🍎,🍓,🍔,🍘,🍚,🍛,🍜,🍝,🍞,☕,🍺'),
  // 手势
  gesture: csvToArray('👀,👁️,👍🏻,👌🏻,👎🏻,🖐🏻️,✌🏻️,👊🏻,✊🏻,🤘🏻,✋🏻'),
  // 心形
  heart: csvToArray('❤️,🧡,💛,💚,💙,💜,🖤,💔,❣️,💕,💞,💓,💗,💖,💘,💝'),
  // 节日
  festival: csvToArray('🎉,🎊,✨,🎈,🎁,🎃,🎄,🛶,🐲,⛄,☃️,🎅🏻'),
};

export default emojiMap;
