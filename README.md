# GAS Peer Evaluation

Google Apps Script（GAS）とGoogle Sheetsを利用した、授業・発表用の相互評価Webアプリです。

複数の授業を1つのGoogleスプレッドシートと1つのWebアプリで管理できます。

生徒（学生）はWebブラウザから発表者を選択して評価を送信し、教員はGoogleスプレッドシート上から評価結果を集計して発表者へメール送信できます。

## 主な機能

- 複数授業を1つのWebアプリで管理
- 授業コードによる簡易的な入室制限
- URLパラメータによる授業の自動選択
- 個人発表・グループ発表の両方に対応
- 10項目・4段階の相互評価
- 自由記述によるフィードバック
- 同一評価者による二重評価の防止
- 評価者本人への送信内容の控えメール
- 評価項目ごとの平均値算出
- 発表者全員への評価結果メール送信
- 授業ごとの受付開始・停止

## 想定環境

2026年9月時点で、以下の環境を想定しています。

- Google Apps Script
- V8 Runtime
- Google Sheets
- Gmail
- Google Workspace
- JavaScript
- HTML / CSS
- Google Chrome
- Safari
- Microsoft Edge

PCおよびスマートフォンのWebブラウザからの利用を想定しています。

評価者の識別には、

```javascript
Session.getActiveUser().getEmail()
```

を使用しています。

Google Workspaceの設定やWebアプリの公開方法によってはメールアドレスを取得できない場合があるため、実際の運用前に生徒（学生）用アカウントで動作確認してください。

## ファイル構成

```text
gas-peer-evaluation/
├── Code.gs
├── index.html
├── PresenterSelector.html
├── README.md
├── LICENSE
└── samples/
    ├── courses.csv
    ├── presenters.csv
    └── evaluation_headers.csv
```

### Code.gs

Apps Scriptのサーバー側処理です。

以下を担当します。

- 授業情報の取得
- 授業コードの確認
- 発表者一覧の取得
- 評価結果の保存
- 二重評価チェック
- 控えメールの送信
- 評価結果の集計
- 発表者への結果メール

### index.html

生徒（学生）が利用する相互評価Webフォームです。

### PresenterSelector.html

教員がスプレッドシートから評価結果を送信するときに使用するダイアログです。

---

# セットアップ

## 1. Googleスプレッドシートを作成する

次の3つのシートを作成してください。

```text
授業設定
発表者
相互評価
```

---

## 2. 「授業設定」シート

以下の形式で設定します。

| 授業ID | 授業名 | 授業コード | 受付中 |
|---|---|---|---|
| class01 | 授業A | 1234 | TRUE |
| class02 | 授業B | 5678 | TRUE |
| class03 | 授業C | 2468 | FALSE |

### 授業ID

プログラム内部で授業を識別するIDです。

```text
class01
class02
class03
```

のような半角英数字を推奨します。

### 授業コード

生徒（学生）が評価フォームへ入るための簡易コードです。

先頭に `0` を使用する場合は、Google Sheetsで授業コード列を「プレーンテキスト」に設定してください。

### 受付中

`TRUE` の授業だけが生徒（学生）側に表示されます。

`FALSE` にしても、過去の評価結果を教員側から送信することはできます。

---

## 3. 「発表者」シート

以下の形式で登録します。

| 授業ID | 発表者 | メールアドレス |
|---|---|---|
| class01 | 1班 | user01@example.com |
| class01 | 1班 | user02@example.com |
| class01 | 2班 | user03@example.com |
| class02 | 1班 | user04@example.com |

同じ発表者・班に複数のメールアドレスを登録できます。

例えば、

```text
class01 | 1班 | user01@example.com
class01 | 1班 | user02@example.com
class01 | 1班 | user03@example.com
```

とすると、1班の評価結果が3名全員へ送信されます。

---

## 4. 「相互評価」シート

以下の17列を使用します。

| 列 | 内容 |
|---|---|
| A | 授業ID |
| B | 発表者 |
| C | 評価者メール |
| D〜M | 評価項目1〜10 |
| N | 今後も続けてほしい点 |
| O | 改善点 |
| P | 準備不足 |
| Q | タイムスタンプ |

D〜Mの1行目には、実際に使用する評価項目名を入力してください。

これらの見出しは、発表者へ送信するメールにも使用されます。

---

# Apps Scriptへの登録

対象のGoogleスプレッドシートから、

```text
拡張機能
→ Apps Script
```

を開きます。

次の3ファイルを作成します。

```text
Code.gs
index.html
PresenterSelector.html
```

このリポジトリ内の同名ファイルの内容を、それぞれコピーしてください。

---

# SPREADSHEET_IDの設定

Apps Scriptの、

```text
プロジェクトの設定
→ スクリプト プロパティ
```

を開き、

```text
SPREADSHEET_ID
```

というプロパティを作成します。

値には対象となるGoogleスプレッドシートのIDを設定します。

例えばURLが、

```text
https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXXXXX/edit
```

なら、

```text
XXXXXXXXXXXXXXXXXXXX
```

の部分です。

---

# Webアプリとしてデプロイ

Apps Scriptから、

```text
デプロイ
→ 新しいデプロイ
→ ウェブアプリ
```

を選択します。

Google Workspaceで使用する場合は、組織の設定に合わせて適切なアクセス範囲を指定してください。

このアプリでは、

```javascript
Session.getActiveUser().getEmail()
```

を利用して評価者を識別します。

本番運用前に、生徒（学生）用アカウントからアクセスしてメールアドレスが正しく取得できることを確認してください。

---

# 授業ごとのURL

通常のWebアプリURLが、

```text
https://script.google.com/macros/s/XXXXXXXX/exec
```

の場合、

```text
https://script.google.com/macros/s/XXXXXXXX/exec?course=class01
```

のようにすると、`class01` が最初から選択された状態で表示されます。

授業ごとにQRコードを作成すると、

```text
QRコード
↓
授業自動選択
↓
授業コード入力
↓
相互評価
```

という運用ができます。

---

# 評価結果の送信

スプレッドシートを開くと、

```text
相互評価ツール
```

というメニューが追加されます。

そこから、

```text
評価結果を送信
```

を選択します。

授業と発表者を選択すると、

- 各評価項目の平均値
- 各評価者の自由記述

がまとめられ、発表者として登録されている全員へメール送信されます。

---

# 二重評価について

同一評価かどうかは、

```text
授業ID
+
発表者
+
評価者メールアドレス
```

で判定します。

そのため、

```text
class01 + 1班 + user01@example.com
```

と

```text
class02 + 1班 + user01@example.com
```

は別の評価として扱われます。

保存時には `LockService` も使用し、ほぼ同時に複数リクエストが発生した場合の二重登録を防止しています。

---

# セキュリティ・個人情報について

このアプリでは、

- 生徒（学生）のメールアドレス
- 評価結果
- 自由記述

を扱います。

実際の教育現場で利用する場合は、所属組織の個人情報保護方針やGoogle Workspaceの管理ポリシーに従ってください。

Googleスプレッドシート自体を生徒（学生）へ共有する必要はありません。

生徒（学生）にはWebアプリのURLのみを案内してください。

## GitHubへ公開するときの注意

以下の情報はリポジトリへコミットしないでください。

- 実際の生徒（学生）のメールアドレス
- 実際の授業コード
- 実際の相互評価データ
- GoogleスプレッドシートID
- 組織内部のみで利用する情報

このリポジトリに含まれるサンプルデータはすべてダミーデータです。

---

# カスタマイズ

現在、評価項目数は10項目に固定されています。

評価内容は `index.html` 内の、

```javascript
const criteriaData = [
  ...
];
```

で設定しています。

項目数そのものを変更する場合は、`Code.gs` の列設定も合わせて変更してください。

---

# License

MIT License

詳細は `LICENSE` を参照してください。
