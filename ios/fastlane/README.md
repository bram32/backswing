fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios generate

```sh
[bundle exec] fastlane ios generate
```

Copy the web app into the bundle and regenerate the Xcode project

### ios register

```sh
[bundle exec] fastlane ios register
```

Make sure the App ID and the App Store Connect app record exist

### ios archive

```sh
[bundle exec] fastlane ios archive
```

Generate, sign and export a distribution-signed .ipa

### ios testers

```sh
[bundle exec] fastlane ios testers
```

Add the TestFlight tester to a group (internal first, external as fallback)

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Build and upload a TestFlight build

### ios testers_api

```sh
[bundle exec] fastlane ios testers_api
```

Add the TestFlight tester through the public App Store Connect API

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
