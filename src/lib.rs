use zed_extension_api as zed;

/// Embeds the language server JS at compile time so it can be written
/// to the extension's working directory at runtime.
const SERVER_JS: &str = include_str!("../server/index.js");

/// Zed extension that manages a Node.js language server for counting LLM tokens.
///
/// On first activation, installs the required npm packages (vscode-languageserver,
/// vscode-languageserver-textdocument, js-tiktoken) into the extension directory,
/// then writes the bundled server script and starts it.
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
        let work_dir = std::env::current_dir().map_err(|e| e.to_string())?;

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

            // Reason: The extension's source files aren't copied to the working directory.
            // We embed server/index.js at compile time and write it here so Node can find it.
            let server_dir = work_dir.join("server");
            std::fs::create_dir_all(&server_dir).map_err(|e| e.to_string())?;
            std::fs::write(server_dir.join("index.js"), SERVER_JS)
                .map_err(|e| e.to_string())?;

            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::None,
            );
            self.did_install = true;
        }

        let server_path = work_dir.join("server/index.js");

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
