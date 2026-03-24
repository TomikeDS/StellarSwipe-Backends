upstream stellarswipe_backend {
    least_conn;
    server backend1: 3000;
    server backend2: 3000;
    server backend3: 3000;
}

server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://stellarswipe_backend;
            proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X- Real - IP $remote_addr;
        proxy_set_header X - Forwarded - For $proxy_add_x_forwarded_for;
        proxy_set_header X - Forwarded - Proto $scheme;
        
        # Instance identification header
        add_header X - Backend - Server $upstream_addr;
}

location / health {
        proxy_pass http://stellarswipe_backend/health;
        access_log off;
}
}
