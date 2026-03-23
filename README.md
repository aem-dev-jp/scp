# Sidekick Preview & Publish Extention
This is a Sidekick extension that executes both Preview and Publish with a single click operation (and path specification). Its implementation requires AEM EDS project code and AppBuilder runtime worker code.

## Project Code
AEM EDS Project : https://github.com/aem-dev-jp/scp
AppBuilder Runtime : https://github.com/aem-dev-jp/scp-appbuilder-runtime


## Environments
- Preview: https://main--singleapublish--aem-dev-jp.aem.page/
- Live: https://main--singleapublish--aem-dev-jp.aem.live/

## Documentation

- **Preview & Publish（Sidekick × App Builder）:** [docs/preview-publish.md](docs/preview-publish.md)

Before using the aem-boilerplate, we recommand you to go through the documentation on https://www.aem.live/docs/ and more specifically:
1. [Developer Tutorial](https://www.aem.live/developer/tutorial)
2. [The Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project)
3. [Web Performance](https://www.aem.live/developer/keeping-it-100)
4. [Markup, Sections, Blocks, and Auto Blocking](https://www.aem.live/developer/markup-sections-blocks)

## Installation

```sh
npm i
```

## Linting

```sh
npm run lint
```

## Local development

1. Create a new repository based on the `aem-boilerplate` template
1. Add the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync) to the repository
1. Install the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`
1. Start AEM Proxy: `aem up` (opens your browser at `http://localhost:3000`)
1. Open the `{repo}` directory in your favorite IDE and start coding :)
