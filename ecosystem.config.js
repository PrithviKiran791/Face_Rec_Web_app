module.exports = {
  apps: [
    {
      name: "Attendance-Backend",
      script: "python3",
      args: "-m uvicorn main:app --host 0.0.0.0 --port 8000",
      cwd: "./backend",
      interpreter: "python3",
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
