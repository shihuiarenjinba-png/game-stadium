# EKIDEN MANAGER — Microsoft Store商品枠・2026-10-18の確定判定

**商品枠：確認済み / 状態：In draft / Microsoft Storeへの販売提出：HOLD**。

ユーザー提供のPartner Centerの「View product identity」画面で、以下の正式値を確認した。

- Store ID: `9NL1HLJRFQ39`
- Package Identity Name: `OkinawaDesktopTools.EKIDENMANAGER`
- Publisher: `CN=46263F21-A700-41DB-8C9B-114C22FB82FC`
- Publisher Display Name: `Okinawa Desktop Tools`
- State: `In draft` — `Start submission` が表示。まだ認証提出ではない。

機械可読な照合元：`store/partner-center-identity.json`。コード担当向け手順：`docs/PARTNER_CENTER_MSIX_HANDOFF_20261018_JA.md`。

### 次のゲート
- **Product Slot：PASS** — 商品名・専用Store ID/Identityを確保。
- **MSIX Identity照合：ソースに実装** — `npm run audit:store-identity`、Windowsコード担当のテスト待ち。
- **正式MSIX/WACK/Win実機：HOLD** — テスト完走/素材/署名/保存互換性/年齢/価格がまだ未承認。
- **Store submission：HOLD** — 所有者の明示的な販売承認が必要。予約完了を公開許可と解釈しない。

main、旧リリース、別作品のIdentity、既存セーブは変更しない。
