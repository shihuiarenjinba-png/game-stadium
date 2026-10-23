# EKIDEN MANAGER — Identity・MSIXバージョンゲート監査

- 対象ブランチ: feature/race-to-training-flow-20261019
- 対象リポジトリ: shihuiarenjinba-png/game-stadium
- 対象Store ID（履歴上の記録値）: 9NL1HLJRFQ39
- 監査時のソース基準: このファイルと同じコミットの親コミットを記録する
- Partner Centerのライブ確認: この作業では実施していない
- 提出・公開: HOLD

## 監査で確認した問題

1. package.json.version は内部アプリ用SemVerの 0.7.0。
2. 旧 scripts/store-msix.cjs は STORE_PACKAGE_VERSION に4要素表記・Major 1以上を要求していた。
3. 同時に STORE_PACKAGE_VERSION === package.json.version + ".0" を要求しており、0.7.0.0 はMajor条件に違反し、Major 1以上の値は文字列連結条件に違反していた。
4. electron-builderの buildVersion は、AppxManifest の Identity.Version と同一の入力欄ではない。このため buildVersion にSTORE_PACKAGE_VERSIONを渡すだけではMSIXパッケージのIdentity.Versionを独立して設定できない。
5. 現時点で正式なStore受理バージョンを裏付ける記録はない。値を自動採番、推定、正式版として確定しない。

## 修正方針

- package.json.version の 0.7.0 は変更しない。NSIS/Portableの既存設定・出力方式も変更しない。
- Store用バージョンは STORE_PACKAGE_VERSION に明示し、独立の検証関数で4要素・0..65535範囲・Major非ゼロ・Revision=0を確認する。
- Windows 10/11向けStoreの版番号ルールはMicrosoftの公式パッケージ要件に従う。公開用番号は既受理バージョンの確認と所有者の明示承認なしに採用しない。
- STORE_PACKAGE_VERSION_APPROVED=YES を明示的な承認ゲートとする。テスト用fixtureでのYESはリリース承認ではない。
- AppxManifest生成後、パッケージを組み立てる前に実行されるappxManifestCreatedフックでIdentity.Versionのみを設定し、Identity.Name、Identity.Publisher、PublisherDisplayNameがstore/partner-center-identity.jsonと完全一致することを検査する。
- MSIXを出力した場合は、生成後の検証でもName、Publisher、PublisherDisplayName、Version、x64、SHA-256を独立照合する。

## Identityの正本と未解決事項

- 唯一のソース: store/partner-center-identity.json
- Name / Publisher / PublisherDisplayNameは設定確認変数ではなく、正本JSONから生成設定へ渡す。
- Package SIDは記録がないためnullのまま。推測して埋めない。Manifestの属性として生成しない。
- Partner Center状態「In draft」は2026-10-18時点の記録。今回ライブで確認した状態ではない。
- 以前受理されたStoreパッケージのVersionは未確認。公開用Versionは未確定。
- 登録ロゴは未配置または承認確認が取れていないため、ビルダーはHOLD。
- package.jsonはelectron-builder 26.15.3を宣言している一方、store-msix.cjsは27.0.0-alpha.10をStore MSIX用として要求している。NSIS/Portable環境を無断変更せず、独立したWindows Storeビルド環境を整えるまでHOLD。
- 正式Store MSIXは未生成のまま。CI、WACK、Windowsでのインストール・起動・保存復元・更新試験、認定、公開は別工程。

## 参考資料

- Microsoft Learn, package version numbering: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements?pivots=store-installer-msix
- Microsoft Learn, package identity: https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/package-identity-overview
- electron-builder MSIX target: https://www.electron.build/docs/msix/
- electron-builder appxManifestCreated hook: https://www.electron.build/docs/features/hooks/

この記録はコード・構成上の監査です。Partner Centerのライブ照合、MSIX生成、署名、WACK、認定、公開の証拠ではありません。
