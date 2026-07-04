#!/usr/bin/env bash
# ------------------------------------------------------------------
# One-time DigitalOcean droplet setup (Ubuntu 24.04, 2 GB / 1 vCPU).
# Run as root on a fresh droplet:  bash server-setup.sh
# Review each section before running — it changes system state.
# ------------------------------------------------------------------
set -euo pipefail

APP_DIR=/var/www/pankajpramanik
DB_NAME=pankajpramanik
DB_USER=appuser

echo "== 1. System packages =="
apt-get update && apt-get upgrade -y
apt-get install -y curl git ufw nginx postgresql postgresql-contrib fail2ban

echo "== 2. Swap (2 GB droplet needs it for Next.js builds) =="
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== 3. Node.js 22 LTS =="
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pm2

echo "== 4. Firewall =="
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "== 5. PostgreSQL database + user =="
DB_PASS=$(openssl rand -hex 24)
sudo -u postgres psql <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
SQL
echo "PostgreSQL user '${DB_USER}' password: ${DB_PASS}"
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
echo "^^ SAVE THIS — you need it for ${APP_DIR}/.env"

echo "== 6. App directory =="
mkdir -p ${APP_DIR} /var/log/pm2
# clone your repo (replace with your repo URL if different):
# git clone git@github.com:pankaj2k9/pankajpramanik.com.git ${APP_DIR}

echo "== 7. Nginx site =="
# cp ${APP_DIR}/deploy/nginx.conf /etc/nginx/sites-available/pankajpramanik.com
# ln -sf /etc/nginx/sites-available/pankajpramanik.com /etc/nginx/sites-enabled/
# rm -f /etc/nginx/sites-enabled/default
# nginx -t && systemctl reload nginx

echo "== 8. TLS (after DNS points here) =="
# apt-get install -y certbot python3-certbot-nginx
# certbot --nginx -d pankajpramanik.com -d www.pankajpramanik.com

echo "== 9. Nightly database backups =="
mkdir -p /var/backups/postgres
cat > /etc/cron.daily/pg-backup <<'CRON'
#!/bin/sh
sudo -u postgres pg_dump pankajpramanik | gzip > /var/backups/postgres/pankajpramanik-$(date +%F).sql.gz
# keep 14 days
find /var/backups/postgres -name '*.sql.gz' -mtime +14 -delete
CRON
chmod +x /etc/cron.daily/pg-backup

echo "== Done. Next steps =="
echo "1. Clone the repo into ${APP_DIR}"
echo "2. Create ${APP_DIR}/.env (copy .env.example, use DATABASE_URL above)"
echo "3. cd ${APP_DIR} && npm ci && npx prisma migrate deploy && npm run db:seed"
echo "4. npm run build && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/"
echo "5. pm2 start deploy/ecosystem.config.js && pm2 save && pm2 startup"
echo "6. Enable the Nginx site (section 7) and run certbot (section 8)"
