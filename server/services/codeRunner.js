const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
const TIMEOUT = 5000; // 5 seconds max

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function runCode(language, code) {
  const id = crypto.randomBytes(8).toString('hex');
  const startTime = Date.now();
  
  try {
    switch (language) {
      case 'python':
        return runPython(id, code, startTime);
      case 'javascript':
        return runJavaScript(id, code, startTime);
      case 'java':
        return runJava(id, code, startTime);
      case 'c':
        return runC(id, code, startTime);
      case 'cpp':
        return runCpp(id, code, startTime);
      case 'csharp':
        return runCSharp(id, code, startTime);
      default:
        return { success: false, output: 'Language not supported for execution', exitCode: 1 };
    }
  } finally {
    // ALWAYS clean up temp files
    cleanupTempFiles(id);
  }
}

function runPython(id, code, startTime) {
  const filePath = path.join(TEMP_DIR, `${id}.py`);
  fs.writeFileSync(filePath, code);
  
  let pythonCmd = 'python3';
  if (process.platform === 'win32') {
    pythonCmd = 'python';
  }

  try {
    const output = execSync(`${pythonCmd} "${filePath}"`, {
      timeout: TIMEOUT,
      maxBuffer: 1024 * 10, // 10KB max output
      cwd: TEMP_DIR,
      env: { PATH: process.env.PATH }, // minimal env, no secrets
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return {
      success: true,
      output: output.toString(),
      exitCode: 0,
      executionTime: Date.now() - startTime
    };
  } catch (error) {
    // If python3 fails on windows/linux, try python as fallback just in case
    if (error.code === 'ENOENT' && pythonCmd === 'python3') {
        try {
            const output2 = execSync(`python "${filePath}"`, {
              timeout: TIMEOUT,
              maxBuffer: 1024 * 10,
              cwd: TEMP_DIR,
              env: { PATH: process.env.PATH },
              stdio: ['pipe', 'pipe', 'pipe']
            });
            return {
              success: true,
              output: output2.toString(),
              exitCode: 0,
              executionTime: Date.now() - startTime
            };
        } catch (err2) {
            return handleExecError(err2, startTime);
        }
    }
    return handleExecError(error, startTime);
  }
}

function runJavaScript(id, code, startTime) {
  const filePath = path.join(TEMP_DIR, `${id}.js`);
  fs.writeFileSync(filePath, code);
  
  try {
    const output = execSync(`node "${filePath}"`, {
      timeout: TIMEOUT,
      maxBuffer: 1024 * 10,
      cwd: TEMP_DIR,
      env: { PATH: process.env.PATH },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return {
      success: true,
      output: output.toString(),
      exitCode: 0,
      executionTime: Date.now() - startTime
    };
  } catch (error) {
    return handleExecError(error, startTime);
  }
}

function runC(id, code, startTime) {
  const srcPath = path.join(TEMP_DIR, `${id}.c`);
  const outPath = path.join(TEMP_DIR, `${id}.out`);
  fs.writeFileSync(srcPath, code);
  
  try {
    // Compile
    execSync(`gcc "${srcPath}" -o "${outPath}" -lm`, {
      timeout: TIMEOUT,
      cwd: TEMP_DIR,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Run
    const output = execSync(`"${outPath}"`, {
      timeout: TIMEOUT,
      maxBuffer: 1024 * 10,
      cwd: TEMP_DIR,
      env: { PATH: process.env.PATH },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return {
      success: true,
      output: output.toString(),
      exitCode: 0,
      executionTime: Date.now() - startTime
    };
  } catch (error) {
    return handleExecError(error, startTime);
  }
}

function runCpp(id, code, startTime) {
  const srcPath = path.join(TEMP_DIR, `${id}.cpp`);
  const outPath = path.join(TEMP_DIR, `${id}.out`);
  fs.writeFileSync(srcPath, code);
  
  try {
    execSync(`g++ "${srcPath}" -o "${outPath}"`, {
      timeout: TIMEOUT,
      cwd: TEMP_DIR,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const output = execSync(`"${outPath}"`, {
      timeout: TIMEOUT,
      maxBuffer: 1024 * 10,
      cwd: TEMP_DIR,
      env: { PATH: process.env.PATH },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return {
      success: true,
      output: output.toString(),
      exitCode: 0,
      executionTime: Date.now() - startTime
    };
  } catch (error) {
    return handleExecError(error, startTime);
  }
}

function runJava(id, code, startTime) {
  // Extract class name from code
  const classMatch = code.match(/class\s+(\w+)/);
  const className = classMatch ? classMatch[1] : 'Main';
  
  const filePath = path.join(TEMP_DIR, `${className}.java`);
  fs.writeFileSync(filePath, code);
  
  try {
    execSync(`javac "${filePath}"`, {
      timeout: TIMEOUT,
      cwd: TEMP_DIR,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const output = execSync(`java -cp "${TEMP_DIR}" ${className}`, {
      timeout: TIMEOUT,
      maxBuffer: 1024 * 10,
      cwd: TEMP_DIR,
      env: { PATH: process.env.PATH },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return {
      success: true,
      output: output.toString(),
      exitCode: 0,
      executionTime: Date.now() - startTime
    };
  } catch (error) {
    return handleExecError(error, startTime);
  }
}

function runCSharp(id, code, startTime) {
  const filePath = path.join(TEMP_DIR, `${id}.cs`);
  fs.writeFileSync(filePath, code);
  
  try {
    const output = execSync(`dotnet-script "${filePath}"`, {
      timeout: TIMEOUT,
      maxBuffer: 1024 * 10,
      cwd: TEMP_DIR,
      env: { PATH: process.env.PATH },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return {
      success: true,
      output: output.toString(),
      exitCode: 0,
      executionTime: Date.now() - startTime
    };
  } catch (error) {
    return handleExecError(error, startTime);
  }
}

function handleExecError(error, startTime) {
  // Timeout
  if (error.killed) {
    return {
      success: false,
      output: 'Error: Code execution timed out (5 second limit)',
      exitCode: 1,
      executionTime: Date.now() - startTime
    };
  }

  // Get stderr output
  let errorOutput = error.stderr?.toString() || error.message || 'Unknown error';
  
  // STRIP server paths from error messages
  errorOutput = errorOutput.replace(/\/.*?temp\//g, '');
  errorOutput = errorOutput.replace(/\\.*?temp\\/g, '');
  errorOutput = errorOutput.replace(/C:\\.*?temp\\/gi, '');
  errorOutput = errorOutput.replace(/[a-f0-9]{16}\./g, ''); // remove hash IDs

  return {
    success: false,
    output: errorOutput,
    exitCode: error.status || 1,
    executionTime: Date.now() - startTime
  };
}

function cleanupTempFiles(id) {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    for (const file of files) {
      if (file.startsWith(id)) {
        fs.unlinkSync(path.join(TEMP_DIR, file));
      }
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

module.exports = { runCode };