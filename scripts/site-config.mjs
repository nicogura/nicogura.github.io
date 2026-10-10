export const routes = {
  home: ['', 'NicoGura | にこぐら 公式ルール・参加ガイド', '初心者歓迎のFiveMライトRPサーバー「NicoGura」。公式ルール、参加方法、経済・料金、法律などをまとめた公式ガイド。'],
  rules: ['rules', '公式ルール', '街のみんなが気持ちよく遊ぶための、ライトRPとマナーの約束。検索やカテゴリーから必要な項目を確認できます。'],
  join: ['join', '参加方法', 'Discordから市民ロール、Rxxxxコードの申請、承認後の再接続まで。NicoGuraへの参加を10ステップで案内します。'],
  character: ['character', 'キャラクター', 'NicoGuraは1人につき1キャラクター。自分らしい市民として、街での生活を楽しみましょう。'],
  economy: ['economy', '経済・料金', '初期資金、飲食、燃料、治療、修理、消耗品とカスタム。街の暮らしに必要な料金をまとめました。'],
  crime: ['crime', '犯罪RP', '犯罪RPの考え方、規模ごとの基準報酬、犯罪一覧。みんなが楽しめるシーンを大切にしましょう。'],
  law: ['law', '法律・罰金', 'PDが扱うゲーム内の法律、罰金、刑期、インパウンドの基準を検索できます。'],
  guides: ['guides', '街ガイド', 'PD、EMS、メカニック、店舗、Life Job、ギャング。街を支える仕事や暮らしの入口をご案内します。'],
  pd: ['pd', 'PD・警察', '治安維持、犯罪・交通対応、捜査を担うPD。市民向けの案内とゲーム内法律をご確認ください。'],
  ems: ['ems', 'EMS・救急', '治療、蘇生、搬送と救急対応を担うEMS。困ったときの案内と治療料金をまとめています。'],
  mechanic: ['mechanic', 'メカニック', '車の修理、整備、カスタム、塗装。愛車と過ごす毎日を支えるサービスと料金の案内です。'],
  shops: ['shops', '店舗', '市民が運営する飲食店やサービスのお店。会話や出会いを楽しみながら利用しましょう。'],
  lifejobs: ['lifejobs', 'Life Job', 'ハンティング、採掘、バス、新聞、タクシー、フードトラック、トレジャーハンターの仕事をご紹介します。'],
  gangs: ['gangs', 'ギャング', '仲間と楽しむギャング活動。結成費用と、街の共通ルールを確認しましょう。'],
  faq: ['faq', 'よくある質問', 'RP初心者、FiveM初心者、キャラクター、参加申請やトラブル相談。初めての方の疑問にお答えします。'],
  contact: ['contact', 'お問い合わせ', '不具合、通報、アイテム消失、補填や処分への相談は公式Discordのお問い合わせ窓口へ。'],
  changelog: ['changelog', '更新履歴', 'NicoGura公式ガイドの変更点と更新履歴をご案内します。']
};
export const publicRoots = ['index.html', '404.html', ...Object.values(routes).map(r => r[0]).filter(Boolean), 'editor', 'assets', 'data', 'robots.txt', 'sitemap.xml', '.nojekyll'];
export const htmlPaths = ['index.html', '404.html', ...Object.values(routes).map(r => r[0]).filter(Boolean).map(p => `${p}/index.html`), 'editor/index.html'];
