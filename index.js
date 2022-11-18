//現状は全データをメモリ上に展開するので、大きなデータでは処理の改善が必要
const fs = require("fs").promises;
const { existsSync } = require("fs");
const path = require("path");

const importPath = "./input";
const exportPath = "./user_log";

//保存対象外のユーザー名
const excludeUserNames = [
  "GitHub",
  "Google Calendar",
  "Google Drive",
  "Zoom",
  "Simple Poll",
];

//保存したい特殊メッセージの種類
//"channel_name"を追加すればチャンネル名変更メッセージが含まれる
const messageSubTypes = [];

const parseJSON = async (targetPath) => {
  const json = await fs.readFile(targetPath, "utf8");
  return JSON.parse(json);
};

(async () => {
  if (existsSync(exportPath)) {
    await fs.rm(exportPath, { recursive: true });
  }

  await fs.mkdir(exportPath, { recursive: true });

  const users = await parseJSON(path.join(importPath, "users.json"));
  const userMessages = new Map();

  //各ユーザーのデータを初期化
  for await (const user of users) {
    userMessages[user.id] = [];
  }

  //チャンネル毎にメッセージを取得
  const channels = await parseJSON(path.join(importPath, "channels.json"));

  for await (const channel of channels) {
    const channelPath = path.join(importPath, channel.name);
    const logFiles = await fs.readdir(channelPath);

    for await (const fileName of logFiles) {
      if (!fileName.endsWith(".json")) {
        continue;
      }

      const targetPath = path.join(channelPath, fileName);
      const json = await parseJSON(targetPath);
      const result = json.map((msg) => {
        return { ...msg, channel: channel.name };
      });

      //メッセージを各ユーザーに登録
      for await (const msg of result) {
        //対象外のメッセージは保存しない
        if (msg.subtype && !messageSubTypes.includes(msg.subtype)) {
          continue;
        }

        const userID = msg.user;
        userMessages[userID].push(msg);
      }
    }
  }

  //結果をjsonに保存
  for await (const user of users) {
    //除外ユーザーなら保存しない
    if (excludeUserNames.includes(user.real_name)) {
      continue;
    }

    const fileName = `${user.real_name}_${user.id}.json`;
    const messages = userMessages[user.id];

    await fs.writeFile(
      path.join(exportPath, fileName),
      JSON.stringify(messages, null, 2)
    );
  }
})();
