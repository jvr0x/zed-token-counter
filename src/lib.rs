use zed_extension_api as zed;

/// Name of the npm package that provides the token counting language server.
const SERVER_PACKAGE: &str = "token-counter-lsp";

/// Zed extension that manages a Node.js language server for counting LLM tokens.
///
/// On first activation, installs the token-counter-lsp npm package (which includes
/// vscode-languageserver, vscode-languageserver-textdocument, and js-tiktoken as
/// dependencies), then starts the language server.
struct TokenCounterExtension {
    /// Tracks whether the server package has been verified/installed this session.
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
        let work_dir = std::env::current_dir().map_err(|e| e.to_string())?;

        if !self.did_install {
            if zed::npm_package_installed_version(SERVER_PACKAGE)?.is_none() {
                zed::set_language_server_installation_status(
                    language_server_id,
                    &zed::LanguageServerInstallationStatus::Downloading,
                );
                let version = zed::npm_package_latest_version(SERVER_PACKAGE)?;
                zed::npm_install_package(SERVER_PACKAGE, &version)?;
            }

            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::None,
            );
            self.did_install = true;
        }

        let server_path = work_dir
            .join("node_modules")
            .join(SERVER_PACKAGE)
            .join("index.js");

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![
                server_path.to_string_lossy().to_string(),
                "--stdio".into(),
            ],
            env: Default::default(),
        })
    }
}

zed::register_extension!(TokenCounterExtension);
