# Lightweight AWS EC2 Deployment - Face Attendance System
(Apache2 + PM2 + STUN/TURN)

This guide provides a "lightweight" deployment method using Apache2 and PM2, avoiding the overhead of Docker.

## 1. Prepare your EC2 Instance
- **OS**: Ubuntu 22.04 LTS
- **Security Group Rules**:
    - **SSH** (22), **HTTP** (80), **HTTPS** (443)
    - **Custom UDP**: 3478, 5349, 49152 - 65535 (For STUN/TURN)

## 2. Install Dependencies
```bash
sudo apt update
sudo apt install -y python3-pip python3-venv nodejs npm apache2
sudo npm install pm2 -g
```

## 3. Configure HTTPS with Apache2
1. **Run the configuration script**:
   ```bash
   chmod +x configure.sh
   ./configure.sh
   ```
2. **Enable modules and site**:
   ```bash
   sudo a2enmod ssl proxy proxy_http
   sudo a2ensite deploy_attendance_app.conf
   sudo systemctl restart apache2
   ```

## 4. Run Application with PM2
1. **Frontend Build**:
   ```bash
   cd frontend && npm install && npm run build && cd ..
   ```
2. **Backend Setup**:
   ```bash
   cd backend && pip install -r requirements.txt && cd ..
   ```
3. **Start Apps**:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

## 5. Configure STUN/TURN Server (Coturn)
If your recognition monitor is laggy or blocked by firewalls, set up a local STUN server:
1. **Install**: `sudo apt install coturn`
2. **Enable**: 
   `sudo nano /etc/default/coturn` -> Set `TURNSERVER_ENABLED=1`
3. **Configure**:
   `sudo nano /etc/turnserver.conf` -> Set `listening-port=3478` and `tls-listening-port=5349`
4. **Start**: `sudo systemctl start coturn`

---
### Environment Variables (.env)
Make sure to create `.env` files in both `/frontend` and `/backend` with your Clerk and Redis credentials before starting PM2.
