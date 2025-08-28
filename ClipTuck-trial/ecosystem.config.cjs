module.exports = {
  apps: [
    {
      name: 'cliptuck',
      script: 'python3',
      args: '-m http.server 3000',
      cwd: __dirname,
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      max_restarts: 3,
      restart_delay: 1000
    }
  ]
}
