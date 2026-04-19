module.exports = {
  apps: [
    {
      name: "Attendance-Backend",
      script: "main.py",
      args: "",
      cwd: "./backend",
      interpreter: "./venv/bin/python3",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "Attendance-Frontend",
      script: "npm",
      args: "start",
      cwd: "./frontend",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
