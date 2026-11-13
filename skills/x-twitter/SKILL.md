---
name: x-twitter
description: Read X/Twitter as the user's own logged-in account (@stmirea). Use whenever a task involves an x.com or twitter.com link, a tweet/post, a thread, someone's recent posts, the user's timeline or bookmarks, or searching X. Never web-fetch x.com; it requires login.
---

Use the `x` CLI (source: ~/code/scripts/src/x.ts). It calls the official X API with the user's OAuth1 token, so results reflect their account. Output is plain text meant for reading; add `--json` for the raw API response.

```
x read <url|id>                  # one post + quoted/replied-to post, media URLs, long text, articles
x thread <url|id> [--author-only] [--max 50]   # whole conversation; --author-only for a self-thread
x user <handle> [--max 10] [--replies]
x timeline [--max 20]            # Following feed, newest first
x bookmarks [--max 20]
x search "<query>" [--max 10]    # X search syntax: from:, to:, -is:retweet, lang:, etc.
x me
```

Each post returned is billed (~$0.005), so keep `--max` as low as the task allows and prefer `read` over `thread` when one post answers the question. `thread` and `search` only cover the last 7 days; for older threads, `read` each post by id.

Videos and images come back as direct URLs you can download. Posts include t.co links already expanded.
