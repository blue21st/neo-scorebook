直近の作業（git diff、または直前のセッションでの変更）を **bug-reviewer サブエージェント** を使ってレビューしてください。

まず変更範囲を把握し、neo score book の状態構造（inning/isTop, batterIdxA/B, runners(番号)/runnerNames(名前), scoreA/scoreB と gameLog の二重得点, gameLog のハーフイニング構造）を踏まえて、バグ・データ不整合だけを探してください。

可読性や命名は今回見なくて結構です。bug-reviewer の出力形式（🔴/🟡/🟢、各指摘に該当箇所・症状・原因・修正案・確認方法）に従ってください。

最後に「🔴の有無」を1行で要約してください。
