# EKIDEN MANAGER — Partner Center商品枠確認とWindows MSIX引き継ぎ

## 2026-10-18 取得した製品固有の正式値

| Partner Center項目 | 画面から確認した値 |
| --- | --- |
| Product | EKIDEN MANAGER / Game |
| Status | **In draft** — 商品枠作成済み。Start submissionが表示される。審査提出と公開は未実施 |
| Store ID | `9NL1HLJRFQ39` |
| Package/Identity/Name | `OkinawaDesktopTools.EKIDENMANAGER` |
| Package/Identity/Publisher | `CN=46263F21-A700-41DB-8C9B-114C22FB82FC` |
| Package/Properties/PublisherDisplayName | `Okinawa Desktop Tools` |
| Package Family Name | `OkinawaDesktopTools.EKIDENMANAGER_j8yefg9jgfh58` |

照合元：ユーザーが2026-10-18に提供した **Partner Center > View product identity** の画面。ソース・実行環境に使用する値は `store/partner-center-identity.json` に記録した。

**注意:** `Package Family Name` はIdentity Nameの代わりに入力しない。異なるゲームのStore IDとPackage Identity Nameを取り違えない。Store IDだけでは署名証明書や実物のMSIXは生成されない。Package SIDは本作の配布用設定に不要なので保存・流用しない。

## コード担当がWindows PowerShellで使用する値

```powershell
$env:STORE_IDENTITY_NAME = "OkinawaDesktopTools.EKIDENMANAGER"
$env:STORE_PUBLISHER = "CN=46263F21-A700-41DB-8C9B-114C22FB82FC"
$env:STORE_PUBLISHER_DISPLAY_NAME = "Okinawa Desktop Tools"
$env:STORE_ID = "9NL1HLJRFQ39"
$env:STORE_IDENTITY_CONFIRMED = "YES" # Partner Centerの原画面と照合した場合のみ
# ロゴ確認・権利確認・パッケージ版の正式承認後に限り設定
# $env:STORE_BRAND_APPROVED = "YES"
# $env:STORE_PACKAGE_VERSION = "1.0.0.0"
```

```powershell
npm run audit:store-identity\nnpm run audit:msix\nnpm test\n# 上のゲートがすべてPASSした場合だけ npm run build:msix
```

既存の `npm run build:win`（NSIS / Portable、electron-builder 26.15.3）はそのまま。独立した `scripts/store-msix.cjs` にMSIX候補生成経路を新設。v27 Betaの `electron-builder 27.0.0-alpha.10` は**現環境に未導入**であり、正式ロゴ・商用版のバージョン・Windows実機試験を通過するまで意図的にHOLDする。旧インストーラーを勝手に書き換えたり差し替えたりしない。

## 絶対に飛ばさない受入検査

1. **このゲーム専用のfeatureブランチ**を新規フォルダに取得。Git SHAと元main/Releaseを記録して保護。
2. コード・ソースのテスト（実際のNode終了コード・ログ）とWindows GUIの画面・セーブ・初回操作を確認。
3. ロゴ・商標・素材・IARC年齢区分・価格・ストア説明・スクリーンショットを作品別に正式承認。
4. 正式なMSIX候補の内部 `AppxManifest.xml` のIdentity.Name、Publisher、Version、x64と所定のストアロゴ4点を確認。古いEXEやZIPの拡張子を変更したものは不可。
5. Windows 11 x64でインストール・起動・DPI 100/125/150/200%・保存/再起動・旧セーブ移行・更新・削除を試験。正式な署名経路とWACKの実測証跡を残す。
6. Store掲載情報、年齢区分、購入意向、ゲーム体験が販売品質に達したことをレビュー。所有者の明示的な指示なしに審査提出しない。

## 返却が必要な証拠

リポジトリ/ブランチ/SHA、Nodeテスト結果、パッケージ名とSHA256、内部Identity.Name・Publisher・Version・Package Family Name、Windows操作試験結果、WACK XML、残る不具合、Store審査提出の可否。

**現判定: PRODUCT SLOT CONFIRMED / PACKAGE NOT CERTIFIED / STORE SUBMISSION HOLD**。

Microsoft公式:
- https://learn.microsoft.com/en-us/windows/apps/publish/faq/get-started-with-the-microsoft-store
- https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/package-identity-overview
- https://www.electron.build/docs/msix/
