tirex-cli
====
a cli tool for discovering and installing packages from Texas Intrument's Resource Explorer website

Features
--

- list packages availbe
- streaming download and unzip with filtering

CLI EXAMPLE
--

  tirex i com.ti.SIMPLELINK_CC2640R2_SDK__5.30.00.03 sdk_docs --filter_path '**/docs/**' --trim 1

Installs only the docs into directory sdk_docs
