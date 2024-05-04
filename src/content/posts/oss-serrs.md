---
title: "OSS: Goのアプリケーション用エラーハンドリングライブラリを作成した"
published: 2024-04-25
description: "Goのアプリケーション用エラーハンドリングライブラリを作成した"
tags: [tech,oss]
category: Works
draft: false
---


# Goのアプリケーション用エラーハンドリングライブラリを作成した

https://github.com/ryomak/serrs


## 背景
Goのアプリケーションを作る時のエラーハンドリングにいつも迷います。
特にスタックトレースとSentryへのエラー送信が必要な時、はライブラリも限られるので、自分で作ってみました。


## 使い方
具体的な方法は、以下を参照してください。
https://zenn.dev/ryomak/articles/go-error-sentry


## できること
- エラーにスタックトレースを追加
- エラーに独自オブジェクトを保存可能
- エラーをSentryに送信。
  - 良い感じにスタックトレースが表示されます。
  - 良い感じにWrapしたエラー情報が表示される