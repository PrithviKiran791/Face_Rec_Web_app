module.exports = {
  apps: [
    {
      name: "Attendance-Backend",
      script: "venv/bin/python3",
      args: "-m uvicorn main:app --host 0.0.0.0 --port 8000",
      cwd: "./backend",
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
