# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - link "ServiceButler logo" [ref=e5] [cursor=pointer]:
        - /url: /
        - img "ServiceButler logo" [ref=e6]
      - generic [ref=e7]:
        - generic [ref=e8]:
          - heading "Sign in" [level=1] [ref=e9]
          - paragraph [ref=e10]: Use your work email to get a secure magic link.
        - generic [ref=e12]:
          - generic [ref=e13]:
            - generic [ref=e14]: Email
            - textbox "you@company.com" [ref=e15]
          - button "Send Magic Link" [ref=e16] [cursor=pointer]
      - generic [ref=e17]:
        - generic [ref=e18]:
          - heading "Dev Quick Login" [level=2] [ref=e19]
          - paragraph [ref=e20]: "Development only. Uses `DEV_AUTH_PASSWORD` and redirects to dashboard."
        - generic [ref=e21]:
          - button "Login as Owner" [ref=e23] [cursor=pointer]
          - button "Login as Dispatcher" [ref=e25] [cursor=pointer]
          - button "Login as Tech" [ref=e27] [cursor=pointer]
  - button "Open Next.js Dev Tools" [ref=e33] [cursor=pointer]:
    - img [ref=e34]
  - alert [ref=e37]
```