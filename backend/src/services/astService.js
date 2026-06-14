const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const path = require("path");

// ---------- JS / TS ----------

const parseFileToAST = (filePath, fileContent) => {
  try {
    const isTSX = filePath.endsWith(".tsx");
    const isTS = filePath.endsWith(".ts") || isTSX;
    const isJSX = filePath.endsWith(".jsx") || isTSX;

    const plugins = ["decorators-legacy"];
    if (isJSX) plugins.push("jsx");
    if (isTS) plugins.push(["typescript", { isTSX }]);

    return parser.parse(fileContent, {
      sourceType: "unambiguous",
      plugins,
      allowReturnOutsideFunction: true,
      errorRecovery: true,
    });
  } catch (err) {
    console.error(`Failed to parse ${filePath}: ${err.message}`);
    return null;
  }
};

const getJSImports = (filePath, fileContent) => {
  const ast = parseFileToAST(filePath, fileContent);
  if (!ast) return [];

  const dir = path.dirname(filePath);
  const imports = [];

  const resolveSource = (source) => {
    if (!source.startsWith(".")) return source;
    return path.join(dir, source).replace(/\\/g, "/");
  };

  traverse(ast, {
    ImportDeclaration({ node }) {
      imports.push(resolveSource(node.source.value));
    },
    CallExpression({ node }) {
      const isRequire =
        node.callee.type === "Identifier" && node.callee.name === "require";
      const isDynamicImport = node.callee.type === "Import";
      if ((isRequire || isDynamicImport) && node.arguments[0]) {
        const arg = node.arguments[0];
        if (arg.type === "StringLiteral" || arg.type === "Literal") {
          imports.push(resolveSource(arg.value));
        }
      }
    },
    ExportAllDeclaration({ node }) {
      if (node.source) imports.push(resolveSource(node.source.value));
    },
    ExportNamedDeclaration({ node }) {
      if (node.source) imports.push(resolveSource(node.source.value));
    },
  });

  return imports;
};

// ---------- Python ----------

const getPythonImports = (filePath, fileContent) => {
  const dir = path.dirname(filePath);
  const imports = [];

  // from .X.Y import Z  or  from X.Y import Z
  const fromRe = /^from\s+(\.+[\w.]*|[\w][\w.]*)\s+import\b/gm;
  // import X.Y.Z  (no 'from')
  const importRe = /^import\s+([\w][\w.]*)/gm;

  const resolveRelative = (module) => {
    const dotCount = (module.match(/^\.+/) || [""])[0].length;
    const name = module.slice(dotCount).replace(/\./g, "/");
    let base = dir;
    for (let i = 1; i < dotCount; i++) base = path.dirname(base);
    return (name ? path.join(base, name) : base).replace(/\\/g, "/");
  };

  let m;
  while ((m = fromRe.exec(fileContent)) !== null) {
    const mod = m[1];
    imports.push(mod.startsWith(".") ? resolveRelative(mod) : mod.replace(/\./g, "/"));
  }
  while ((m = importRe.exec(fileContent)) !== null) {
    imports.push(m[1].replace(/\./g, "/"));
  }

  return imports;
};

// ---------- Java ----------

const getJavaImports = (filePath, fileContent) => {
  const imports = [];
  const re = /^import\s+(?:static\s+)?([\w.]+)\s*;/gm;
  let m;
  while ((m = re.exec(fileContent)) !== null) {
    imports.push(m[1].replace(/\./g, "/"));
  }
  return imports;
};

// ---------- Go ----------

const getGoImports = (filePath, fileContent) => {
  const dir = path.dirname(filePath);
  const imports = [];

  // Single: import "pkg"
  const single = /^import\s+"([^"]+)"/gm;
  // Block: import ( "pkg1"\n "pkg2" )
  const block = /^import\s+\(([^)]+)\)/gm;
  const strRe = /"([^"]+)"/g;

  let m;
  while ((m = single.exec(fileContent)) !== null) {
    const src = m[1];
    imports.push(src.startsWith(".") ? path.join(dir, src).replace(/\\/g, "/") : src);
  }
  while ((m = block.exec(fileContent)) !== null) {
    let s;
    while ((s = strRe.exec(m[1])) !== null) {
      const src = s[1];
      imports.push(src.startsWith(".") ? path.join(dir, src).replace(/\\/g, "/") : src);
    }
  }

  return imports;
};

// ---------- Ruby ----------

const getRubyImports = (filePath, fileContent) => {
  const dir = path.dirname(filePath);
  const imports = [];
  const re = /(?:require|require_relative|load)\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(fileContent)) !== null) {
    const src = m[1];
    imports.push(src.startsWith(".") ? path.join(dir, src).replace(/\\/g, "/") : src);
  }
  return imports;
};

// ---------- Rust ----------

const getRustImports = (filePath, fileContent) => {
  const imports = [];
  const re = /^use\s+([\w:]+)/gm;
  let m;
  while ((m = re.exec(fileContent)) !== null) {
    imports.push(m[1].replace(/::/g, "/"));
  }
  return imports;
};

// ---------- PHP ----------

const getPHPImports = (filePath, fileContent) => {
  const dir = path.dirname(filePath);
  const imports = [];
  const re = /(?:require|require_once|include|include_once)\s+['"]([^'"]+)['"]/g;
  const useRe = /^use\s+([\w\\]+)/gm;
  let m;
  while ((m = re.exec(fileContent)) !== null) {
    const src = m[1];
    imports.push(src.startsWith(".") ? path.join(dir, src).replace(/\\/g, "/") : src);
  }
  while ((m = useRe.exec(fileContent)) !== null) {
    imports.push(m[1].replace(/\\/g, "/"));
  }
  return imports;
};

// ---------- C / C++ ----------

const getCImports = (filePath, fileContent) => {
  const dir = path.dirname(filePath);
  const imports = [];
  // #include "local.h"  or  #include <system.h>
  const re = /#include\s+["<]([^">]+)[">]/g;
  let m;
  while ((m = re.exec(fileContent)) !== null) {
    const src = m[1];
    // Only track local includes (quoted), not system ones (<...>)
    if (!m[0].includes("<")) {
      imports.push(path.join(dir, src).replace(/\\/g, "/"));
    } else {
      imports.push(src);
    }
  }
  return imports;
};

// ---------- C# ----------

const getCSharpImports = (filePath, fileContent) => {
  const imports = [];
  const re = /^using\s+([\w.]+)\s*;/gm;
  let m;
  while ((m = re.exec(fileContent)) !== null) {
    imports.push(m[1].replace(/\./g, "/"));
  }
  return imports;
};

// ---------- Universal dispatcher ----------

const JS_EXTS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);

const getImports = (filePath, fileContent) => {
  if (!fileContent) return [];
  const ext = path.extname(filePath).toLowerCase();

  if (JS_EXTS.has(ext)) return getJSImports(filePath, fileContent);
  if (ext === ".py") return getPythonImports(filePath, fileContent);
  if (ext === ".java") return getJavaImports(filePath, fileContent);
  if (ext === ".go") return getGoImports(filePath, fileContent);
  if (ext === ".rb") return getRubyImports(filePath, fileContent);
  if (ext === ".rs") return getRustImports(filePath, fileContent);
  if (ext === ".php") return getPHPImports(filePath, fileContent);
  if ([".c", ".cc", ".cpp", ".cxx", ".h", ".hpp"].includes(ext)) return getCImports(filePath, fileContent);
  if (ext === ".cs") return getCSharpImports(filePath, fileContent);

  return [];
};

module.exports = { getImports };
