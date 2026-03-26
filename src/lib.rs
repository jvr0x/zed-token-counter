use zed_extension_api as zed;

/// Zed extension that manages a Node.js language server for counting LLM tokens.
///
/// On first activation, installs the required npm packages (vscode-languageserver,
/// vscode-languageserver-textdocument, js-tiktoken) into the extension directory,
/// then starts the language server which provides CodeLens with token counts.
struct TokenCounterExtension {
    /// Tracks whether npm dependencies have been verified/installed this session.
    did_install: bool,
}

impl zed::Extension for TokenCounterExtension {
    fn new() -> Self {
        Self { did_install: false }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        if !self.did_install {
            let packages = [
                "vscode-languageserver",
                "vscode-languageserver-textdocument",
                "js-tiktoken",
            ];

            for name in packages {
                if zed::npm_package_installed_version(name)?.is_none() {
                    zed::set_language_server_installation_status(
                        language_server_id,
                        &zed::LanguageServerInstallationStatus::Downloading,
                    );
                    let version = zed::npm_package_latest_version(name)?;
                    zed::npm_install_package(name, &version)?;
                }
            }

            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::None,
            );
            self.did_install = true;
        }

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec!["server/index.js".into(), "--stdio".into()],
            env: Default::default(),
        })
    }
}

zed::register_extension!(TokenCounterExtension);
