# EKIDEN MANAGER — Microsoft Store登録前ゲート

- **現在の判断：第2登録候補（条件付き）**
- 暫定販売表示名：`EKIDEN MANAGER`（**使用可能・商標・正式表記は未確認**。Partner Centerの使用可能判定と最終決定が必要）
- 登録作品のGitHub正本：`https://github.com/shihuiarenjinba-png/game-stadium/tree/feature/commercial-coach-ux-20261018`
- 未達項目：UI・長期バランス・セーブ互換、予想/仮想払戻し表現と年齢レーティング、Nodeテスト、正式MSIX/WACK
- Microsoftで実際に**名前を予約済みか：未確認／このタブからは実施していない**
- 実際のStore ID：**未取得**。Package Identity Name / Publisher / Package Family Name：**未取得**。
- 現時点の正式MSIX・WACK：**未合格**。申請提出：**HOLD**。

# Microsoft Store商品枠の判定・Identity受け渡し — 2026-10-18

## 登録と販売開始を混同しない
1. 名前予約（Partner Center「アプリとゲーム」→「新しい製品」→「ゲーム / MSIX・PWA」）：完成前でも可能。ただしMicrosoft公式資料によれば未使用の名前予約には**3か月の期限**がある。
2. 予約後の「Start submission」で**下書き**を作成できる。価格・公開国/地域・対象年齢・パッケージ・商品情報を準備するが、品質ゲートを通過するまで「認定に提出」は押さない。
3. 正式な審査提出には、製品固有のIdentity/Publisherに一致した正規MSIX、Windows GUI・セーブ回帰・WACKなどの証跡が必要。ユーザーの許可なしに提出・公開しない。

参考：
- https://learn.microsoft.com/ja-jp/windows/apps/publish/publish-your-app/msix/reserve-your-apps-name
- https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/create-app-submission
- https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/package-version-numbering

## 8作品の商品枠判定
| 作品 | 今の扱い |
| --- | --- |
| 引継ぎ室（game-new） | 第1登録候補。今後3か月以内に提出を目指せるか・名称が最終確定か確認後、名前予約／下書き |
| EKIDEN MANAGER（game-stadium） | 第2登録候補。販売機能・レーティング方針が決まれば予約候補 |
| LUCK LAB（game） | SHA256原本不一致解決まで保留 |
| SmallBusinessSimulator | 店舗成長や長期試遊が未完成、保留 |
| UsedItemShopSimulator | 買い取り・修理・鑑定など差別化が未完成、保留 |
| FactoryInspectionSimulator | 製品進行と長期やり込みが未完成、保留 |
| NightOfficeAuditor | シナリオの奥行きと第三者試遊が未完成、保留 |
| finance-simulation | GitHub本体が未着手の空リポジトリ、保留 |

この順序はGitHubソースと受入資料の現状評価。**Microsoft上で実際に名前を予約した・公開したという意味ではない。** 有料版の競合調査、価格帯、年齢区分、権利は作品別に決め直す。

## 名前予約が済んだら受け取る情報（安全な記録）
各作品ごとに以下を**Partner Centerから正確に転記**し、コード担当のWindows MSIXビルドに使用する。
- 登録済みの製品表示名（日本語・英語を区別）
- Partner Centerの**Store product ID / Store ID**
- 「製品管理 → アプリID（View app identity details）」の **Package/Identity Name**
- **Publisher** の正式文字列（大文字小文字、CN= など含め完全一致）
- **Publisher ID** と Package Family Name（画面に表示される場合）
- 製品タイプが **Game / MSIX** であること
- 登録日、予約の有効期限、下書き/審査/公開の現在状態
- 価格・販売地域・レーティングの決定状況（未確定なら未確定と記録）

アカウントのパスワード、セッショントークン、署名用秘密鍵、決済・税務個人情報をGitHubに保存しない。Identityの公開可能な文字列とStore IDのみを、承認された専用設定/文書に反映する。

コード担当は、これらを**ほかの製品からコピーせず**、AppxManifest.xmlやelectron-builder等のビルド設定で当該製品のIdentityを使う。名前の予約前に本番Publisherを推測してMSIXを製造しない。

## 商品枠作成のGO / HOLD
- **NAME GO:** 最終名称・作品独自性が定まる、重複がない、予約後3か月以内の現実的な製品計画がある。
- **DRAFT GO:** Partner Center上の製品を確認でき、基本商品内容・価格・カテゴリー・サポート・プライバシー方針の草案がある。
- **SUBMISSION GO:** 全テスト、Windows実機GUI、セーブ、正式MSIX/WACK、権利/素材/価格/レーティングを根拠付きでPASS。
- どれか未実施・不明なら「未実施/HOLD」と明記し、審査提出しない。

## コード担当とタブの役割
タブ①はゲーム本体・GitHubの修正。コード担当はWindows PCでテスト、パッケージ取得、正式MSIX生成、WACK、実機更新/削除試験を実施。main、旧リリース、保存データを保護して作業する。
