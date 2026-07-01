# USAGI.NETWORK

ここは Dr.USAGI / USAGI.NETWORK 公式ウェブサイトのソースコード管理プロジェクトです。

- 通常のウェブサイトへアクセスしたい場合 → https://usagi.network/
- リンクや表記のミスなどを見つけた場合は → [Issues](https://github.com/usagi/usagi.network/issues)

へどうぞ。

## License

- 特に個別のライセンス表記のないコンテンツは MIT ライセンスに従います。

## Build

This site is built as an Astro static site for GitHub Pages.

```sh
npm ci
npm run build
npm run smoke:site -- http://127.0.0.1:4173/
```

External activity data is refreshed by GitHub Actions and persisted to the
`auto-data` branch. The build uses committed JSON data so the site remains
readable even when upstream APIs are unavailable.

## Author

- Dr.USAGI / USAGI.NETWORK
