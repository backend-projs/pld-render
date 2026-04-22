// ============================================
// PYTHON DANGEROUS PATTERNS
// ============================================
const PYTHON_BLOCKED = {
  imports: [
    'os', 'sys', 'subprocess', 'shutil', 'pathlib',
    'socket', 'http', 'urllib', 'requests', 'ftplib',
    'ctypes', 'multiprocessing', 'threading',
    'importlib', 'signal', 'resource',
    'pickle', 'shelve', 'marshal',
    'tempfile', 'glob', 'fnmatch',
    'webbrowser', 'antigravity',
    'code', 'codeop', 'compile',
    'smtplib', 'poplib', 'imaplib',
    'telnetlib', 'xmlrpc', 'socketserver'
  ],
  patterns: [
    /import\s+os/,
    /from\s+os\s+import/,
    /import\s+sys/,
    /from\s+sys\s+import/,
    /import\s+subprocess/,
    /from\s+subprocess\s+import/,
    /import\s+shutil/,
    /import\s+socket/,
    /from\s+socket\s+import/,
    /import\s+pathlib/,
    /import\s+ctypes/,
    /import\s+multiprocessing/,
    /import\s+threading/,
    /import\s+importlib/,
    /import\s+signal/,
    /import\s+resource/,
    /import\s+pickle/,
    /import\s+tempfile/,
    /import\s+glob/,
    /import\s+webbrowser/,
    /import\s+http/,
    /from\s+http\s+import/,
    /import\s+urllib/,
    /from\s+urllib\s+import/,
    /import\s+requests/,
    /import\s+ftplib/,
    /import\s+smtplib/,
    /import\s+telnetlib/,
    /__import__\s*\(/,
    /exec\s*\(/,
    /eval\s*\(/,
    /compile\s*\(/,
    /globals\s*\(/,
    /locals\s*\(/,
    /getattr\s*\(/,
    /setattr\s*\(/,
    /delattr\s*\(/,
    /open\s*\(/,
    /file\s*\(/,
    /input\s*\(/,         // can hang the process waiting for stdin
    /breakpoint\s*\(/,
    /exit\s*\(/,
    /quit\s*\(/,
    /os\.\w+/,
    /sys\.\w+/,
    /subprocess\.\w+/,
    /shutil\.\w+/,
    /socket\.\w+/,
    /\.system\s*\(/,
    /\.popen\s*\(/,
    /\.exec\w*\s*\(/,
    /\.spawn\s*\(/,
    /\.fork\s*\(/,
    /\.kill\s*\(/,
    /\.remove\s*\(/,
    /\.unlink\s*\(/,
    /\.rmdir\s*\(/,
    /\.mkdir\s*\(/,
    /\.rename\s*\(/,
    /\.chmod\s*\(/,
    /\.chown\s*\(/,
    /while\s+True\s*:/,    // infinite loop
    /while\s+1\s*:/,       // infinite loop
    /recursion|RecursionError/  // might be intentional but risky
  ]
};

// ============================================
// JAVASCRIPT / NODE.JS DANGEROUS PATTERNS
// ============================================
const JAVASCRIPT_BLOCKED = {
  patterns: [
    /require\s*\(\s*['"]child_process['"]\s*\)/,
    /require\s*\(\s*['"]fs['"]\s*\)/,
    /require\s*\(\s*['"]net['"]\s*\)/,
    /require\s*\(\s*['"]http['"]\s*\)/,
    /require\s*\(\s*['"]https['"]\s*\)/,
    /require\s*\(\s*['"]dgram['"]\s*\)/,
    /require\s*\(\s*['"]cluster['"]\s*\)/,
    /require\s*\(\s*['"]os['"]\s*\)/,
    /require\s*\(\s*['"]path['"]\s*\)/,
    /require\s*\(\s*['"]stream['"]\s*\)/,
    /require\s*\(\s*['"]vm['"]\s*\)/,
    /require\s*\(\s*['"]worker_threads['"]\s*\)/,
    /require\s*\(\s*['"]dns['"]\s*\)/,
    /require\s*\(\s*['"]tls['"]\s*\)/,
    /require\s*\(\s*['"]crypto['"]\s*\)/,
    /import\s+.*from\s+['"]child_process['"]/,
    /import\s+.*from\s+['"]fs['"]/,
    /import\s+.*from\s+['"]net['"]/,
    /import\s+.*from\s+['"]http['"]/,
    /import\s+.*from\s+['"]os['"]/,
    /process\.env/,
    /process\.exit/,
    /process\.kill/,
    /process\.cwd/,
    /process\.chdir/,
    /process\.execPath/,
    /process\.argv/,
    /child_process/,
    /\.exec\s*\(/,
    /\.execSync\s*\(/,
    /\.spawn\s*\(/,
    /\.spawnSync\s*\(/,
    /\.fork\s*\(/,
    /fs\.\w+/,
    /eval\s*\(/,
    /Function\s*\(/,
    /new\s+Function/,
    /setTimeout.*while/,   // potential infinite with timeout
    /setInterval/,
    /while\s*\(\s*true\s*\)/,
    /while\s*\(\s*1\s*\)/,
    /for\s*\(\s*;\s*;\s*\)/,
    /fetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /globalThis/,
    /Deno\./,
    /Bun\./
  ]
};

// ============================================
// C LANGUAGE DANGEROUS PATTERNS
// ============================================
const C_BLOCKED = {
  patterns: [
    /#include\s*<stdlib\.h>/,   // system() lives here
    /#include\s*<unistd\.h>/,   // fork, exec, pipe
    /#include\s*<sys\//,        // sys/socket.h, sys/stat.h etc
    /#include\s*<signal\.h>/,
    /#include\s*<pthread\.h>/,
    /#include\s*<dirent\.h>/,
    /#include\s*<fcntl\.h>/,
    /#include\s*<dlfcn\.h>/,    // dlopen, dlsym
    /#include\s*<netinet\//,
    /#include\s*<arpa\//,
    /#include\s*<netdb\.h>/,
    /system\s*\(/,
    /popen\s*\(/,
    /exec[vlpe]*\s*\(/,         // execve, execvp, execl, etc.
    /fork\s*\(/,
    /vfork\s*\(/,
    /clone\s*\(/,
    /kill\s*\(/,
    /socket\s*\(/,
    /connect\s*\(/,
    /bind\s*\(/,
    /listen\s*\(/,
    /accept\s*\(/,
    /send\s*\(/,
    /recv\s*\(/,
    /fopen\s*\(/,               // file access
    /fwrite\s*\(/,
    /fread\s*\(/,
    /remove\s*\(/,
    /rename\s*\(/,
    /unlink\s*\(/,
    /rmdir\s*\(/,
    /mkdir\s*\(/,
    /chdir\s*\(/,
    /chmod\s*\(/,
    /chown\s*\(/,
    /mmap\s*\(/,
    /mprotect\s*\(/,
    /dlopen\s*\(/,
    /dlsym\s*\(/,
    /setuid\s*\(/,
    /setgid\s*\(/,
    /signal\s*\(/,
    /raise\s*\(/,
    /asm\s*\(/,                 // inline assembly
    /__asm__/,
    /__asm/,
    /#pragma/,
    /__attribute__/,
    /while\s*\(\s*1\s*\)/,
    /for\s*\(\s*;\s*;\s*\)/
  ],
  // C also needs: only allow stdio.h, string.h, math.h, stdbool.h, ctype.h
  allowedHeaders: [
    'stdio.h',
    'string.h',
    'math.h',
    'stdbool.h',
    'ctype.h',
    'limits.h',
    'float.h',
    'stddef.h',
    'stdint.h',
    'assert.h',
    'errno.h',
    'time.h'
  ]
};

// ============================================
// C++ DANGEROUS PATTERNS (same as C plus more)
// ============================================
const CPP_BLOCKED = {
  patterns: [
    ...C_BLOCKED.patterns,
    /#include\s*<fstream>/,
    /#include\s*<filesystem>/,
    /#include\s*<thread>/,
    /#include\s*<mutex>/,
    /#include\s*<future>/,
    /#include\s*<chrono>/,      // can be used for timing attacks
    /#include\s*<regex>/,       // ReDoS potential
    /std::system\s*\(/,
    /std::thread/,
    /std::fstream/,
    /std::ifstream/,
    /std::ofstream/,
    /std::filesystem/
  ],
  allowedHeaders: [
    ...C_BLOCKED.allowedHeaders,
    'iostream',
    'string',
    'vector',
    'array',
    'map',
    'set',
    'unordered_map',
    'unordered_set',
    'algorithm',
    'numeric',
    'cmath',
    'iomanip',
    'sstream',
    'stack',
    'queue',
    'deque',
    'list',
    'tuple',
    'utility',
    'functional',
    'iterator',
    'climits',
    'cfloat',
    'cctype',
    'cstring',
    'cstdlib'  // allowed in C++ for atoi etc but system() blocked separately
  ]
};

// ============================================
// JAVA DANGEROUS PATTERNS
// ============================================
const JAVA_BLOCKED = {
  patterns: [
    /Runtime\s*\.\s*getRuntime/,
    /ProcessBuilder/,
    /Process\s+/,
    /\.exec\s*\(/,
    /import\s+java\.io\.File/,
    /import\s+java\.io\.FileWriter/,
    /import\s+java\.io\.FileReader/,
    /import\s+java\.io\.FileInputStream/,
    /import\s+java\.io\.FileOutputStream/,
    /import\s+java\.io\.BufferedWriter/,
    /import\s+java\.io\.BufferedReader/,
    /import\s+java\.io\.PrintWriter/,
    /import\s+java\.nio/,
    /import\s+java\.net/,
    /import\s+java\.lang\.reflect/,
    /import\s+java\.lang\.Runtime/,
    /import\s+java\.lang\.Process/,
    /import\s+java\.lang\.Thread/,
    /import\s+java\.rmi/,
    /import\s+java\.sql/,
    /import\s+javax\./,
    /new\s+File\s*\(/,
    /new\s+Socket\s*\(/,
    /new\s+ServerSocket\s*\(/,
    /new\s+URL\s*\(/,
    /new\s+Thread\s*\(/,
    /System\.exit/,
    /System\.getenv/,
    /System\.getProperty/,
    /System\.setProperty/,
    /System\.load/,
    /System\.loadLibrary/,
    /Class\.forName/,
    /\.getMethod\s*\(/,
    /\.invoke\s*\(/,
    /\.getDeclaredField/,
    /\.setAccessible\s*\(\s*true\s*\)/,
    /ClassLoader/,
    /SecurityManager/,
    /while\s*\(\s*true\s*\)/
  ]
};

// ============================================
// C# DANGEROUS PATTERNS
// ============================================
const CSHARP_BLOCKED = {
  patterns: [
    /System\.Diagnostics\.Process/,
    /Process\.Start/,
    /ProcessStartInfo/,
    /using\s+System\.IO;/,
    /using\s+System\.Net/,
    /using\s+System\.Reflection/,
    /using\s+System\.Threading/,
    /using\s+System\.Runtime/,
    /using\s+System\.Diagnostics/,
    /using\s+System\.Data/,
    /using\s+System\.Security/,
    /File\.\w+/,
    /Directory\.\w+/,
    /FileStream/,
    /StreamWriter/,
    /StreamReader/,
    /WebClient/,
    /HttpClient/,
    /TcpClient/,
    /TcpListener/,
    /Socket\s/,
    /Assembly\.\w+/,
    /Type\.GetType/,
    /Activator\.CreateInstance/,
    /AppDomain/,
    /Environment\.Exit/,
    /Environment\.GetEnvironmentVariable/,
    /Marshal\.\w+/,
    /unsafe\s*\{/,
    /fixed\s*\(/,
    /stackalloc/,
    /DllImport/,
    /extern\s/,
    /Thread\.\w+/,
    /Task\.Run/,
    /while\s*\(\s*true\s*\)/
  ]
};

// ============================================
// MASTER SCANNER
// ============================================
function scanCode(language, code) {
  const configs = {
    python: PYTHON_BLOCKED,
    javascript: JAVASCRIPT_BLOCKED,
    c: C_BLOCKED,
    cpp: CPP_BLOCKED,
    java: JAVA_BLOCKED,
    csharp: CSHARP_BLOCKED
  };

  const config = configs[language];
  if (!config) {
    // Unknown language → always use AI (safe default)
    return { safe: false, reason: 'unsupported_language', threats: [] };
  }

  const threats = [];

  // Check patterns
  for (const pattern of config.patterns) {
    const match = code.match(pattern);
    if (match) {
      threats.push({
        matched: match[0],
        pattern: pattern.toString(),
        line: getLineNumber(code, match.index)
      });
    }
  }

  // For C/C++: check if headers are in allowed list
  if (config.allowedHeaders) {
    const headerMatches = code.matchAll(/#include\s*[<"]([^>"]+)[>"]/g);
    for (const match of headerMatches) {
      const header = match[1];
      if (!config.allowedHeaders.includes(header)) {
        threats.push({
          matched: match[0],
          pattern: 'blocked_header',
          line: getLineNumber(code, match.index),
          message: `Header '${header}' is not allowed`
        });
      }
    }
  }

  return {
    safe: threats.length === 0,
    threats: threats,
    reason: threats.length > 0 ? 'dangerous_code' : 'clean'
  };
}

function getLineNumber(code, index) {
  return code.substring(0, index).split('\n').length;
}

module.exports = { scanCode };