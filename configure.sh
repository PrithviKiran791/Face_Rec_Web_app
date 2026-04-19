#!/bin/bash

# Get the Public IP or Domain
IP_ADDR=$(curl -s http://checkip.amazonaws.com)

# Define the config file path
CONF_FILE="/etc/apache2/sites-available/deploy_attendance_app.conf"

echo "Generating Apache2 configuration for $IP_ADDR..."

# Create the configuration file
sudo bash -c "cat > $CONF_FILE" <<EOF
<VirtualHost *:80>
    ServerName $IP_ADDR
    Redirect / https://$IP_ADDR/
</VirtualHost>

<VirtualHost *:443>
    ServerName $IP_ADDR

    SSLEngine on
    SSLProxyEngine On
    # Use standard snakeoil certs initially; replace with Let's Encrypt later
    SSLCertificateFile    /etc/ssl/certs/ssl-cert-snakeoil.pem
    SSLCertificateKeyFile /etc/ssl/private/ssl-cert-snakeoil.key

    ProxyRequests Off
    ProxyPreserveHost On

    # 1. WebSocket Proxy for AI Recognition
    ProxyPass /ws/ ws://localhost:8000/ws/
    ProxyPassReverse /ws/ ws://localhost:8000/ws/

    # 2. API Proxy
    ProxyPass /api/ http://localhost:8000/api/
    ProxyPassReverse /api/ http://localhost:8000/api/

    # 3. Frontend Proxy (Next.js)
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

</VirtualHost>
EOF

echo "Configuration created at $CONF_FILE"
echo "Next steps: sudo a2enmod ssl proxy proxy_http && sudo a2ensite deploy_attendance_app.conf && sudo systemctl restart apache2"
