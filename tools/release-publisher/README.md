# Isolated release publisher

The release job uses npm 12.2.0 on hosted Node 22 (at least 22.22.2). Its OIDC
exchange writes credentials only to process configuration and reports failures
without logging credentials. This installation never enters the 15-file package.

Three bundled upstream dependencies still have advisories. Ordinary npm overrides
and `audit fix` do not replace bundled modules. The installer copies separately
integrity-locked upstream patches into a new disposable CLI installation, after
checking exact old/new versions, names, unchanged dependency requirements and
absence of directory aliases. It updates that installation's lock to describe
the actual tree and requires a clean production audit before exposing the CLI.
It changes no npm authentication implementation or application dependencies.

Review pins and remove the patches when upstream fixes its bundle. Monthly
maintenance and an audit on every release are required; cash cost is $0. Updating
the CLI requires a fresh hosted release dry run. Do not install this tooling into
the application or use a token to bypass a failed trusted-publisher exchange.

Advisories: [brace-expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr),
[ip-address](https://github.com/advisories/GHSA-rpw4-54j3-4h4q),
[undici](https://github.com/advisories/GHSA-3wwx-pv8p-q78v).
