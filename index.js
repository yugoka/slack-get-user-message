//現状は全データをメモリ上に展開するので、大きなデータでは処理の改善が必要
const fs = require("fs").promises;
const { existsSync } = require("fs");
const path = require("path");

const importPath = "./input";
const exportPath = "./user_log";

//ファイルを含めるかどうか
const includeFiles = false;

//リッチテキストの内容を含めるかどうか
const includeBlocks = false;

//プロフィール内容を含めるかどうか
const includeProfile = false;

//メッセージテキストだけを列挙したjsonを作成する
const createMsgListJson = true;

//メッセージテキストだけを列挙したtextを作成する(マルコフ連鎖とか用)
const createMsgListText = true;

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

        if (!includeFiles) {
          delete msg.files;
          delete msg.attachments;
        }

        if (!includeBlocks) {
          delete msg.blocks;
        }

        if (!includeProfile) {
          delete msg.user_profile;
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

    //テキスト内容だけを列挙したjsonを作成(ほんのり前処理も)
    if (createMsgListJson) {
      const fileName = `text_${user.real_name}_${user.id}.json`;
      const messages = userMessages[user.id].map((msg) => {
        return msg.text.replace(/\<.+?\>/g, "").replace(/\n/g, " ");
      });
      await fs.writeFile(
        path.join(exportPath, fileName),
        JSON.stringify(messages, null, 2)
      );
    }

    //テキストだけを改行区切りで列挙したtxtを作成
    if (createMsgListText) {
      const fileName = `${user.real_name}_${user.id}.txt`;
      const messages = userMessages[user.id].map((msg) => {
        return msg.text.replace(/\<.+?\>/g, "").replace(/\n/g, " ");
      });

      const text = messages.reduce((txt, current) => txt + current + "\n", "");
      await fs.writeFile(path.join(exportPath, fileName), text);
    }
  }
})();
