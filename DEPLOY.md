# 🚀 AI Gem Hunter - Deployment Guide

## Quick Deploy to Digital Ocean

### Option 1: Docker (Recommended)

**1. Create a Droplet**
- Image: Docker on Ubuntu 22.04
- Size: Basic $6/mo (1GB RAM) works fine
- Region: NYC or SFO for lowest latency to Solana

**2. SSH into your droplet**
```bash
ssh root@your-droplet-ip
```

**3. Clone and configure**
```bash
git clone https://github.com/3rdeus/AI-Gem-Hunter.git
cd AI-Gem-Hunter
cp .env.example .env
nano .env  # Fill in your API keys
```

**4. Deploy**
```bash
docker-compose up -d
```

**5. Check status**
```bash
docker-compose logs -f  # View logs
docker-compose ps       # Check health
```

**6. Useful commands**
```bash
docker-compose restart  # Restart service
docker-compose down     # Stop service
docker-compose pull && docker-compose up -d  # Update
```

---

### Option 2: PM2 (No Docker)

**1. Create a Droplet**
- Image: Ubuntu 22.04
- Size: Basic $6/mo

**2. Setup Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**3. Install PM2**
```bash
npm install -g pm2
pm2 startup  # Enable auto-start on boot
```

**4. Clone and configure**
```bash
git clone https://github.com/3rdeus/AI-Gem-Hunter.git
cd AI-Gem-Hunter
npm install
cp .env.example .env
nano .env  # Fill in your API keys
```

**5. Start with PM2**
```bash
pm2 start ecosystem.config.js
pm2 save  # Save process list
```

**6. Useful commands**
```bash
pm2 logs gem-hunter     # View logs
pm2 status              # Check status
pm2 restart gem-hunter  # Restart
pm2 stop gem-hunter     # Stop
```

---

## Environment Variables

Required:
- `HELIUS_API_KEY` - Get from https://helius.dev
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` - Get from https://supabase.com
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` - Create bot via @BotFather

Optional (enhanced features):
- `BIRDEYE_API_KEY` - Better token data
- `GOPLUS_API_KEY` - Security scanning

---

## Monitoring

**Health check endpoint:**
```
http://your-server:3000/health
```

**Set up uptime monitoring:**
- UptimeRobot (free): https://uptimerobot.com
- Add HTTP monitor for your health endpoint
- Get alerts if service goes down

---

## Updating

**Docker:**
```bash
cd AI-Gem-Hunter
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**PM2:**
```bash
cd AI-Gem-Hunter
git pull
npm install
pm2 restart gem-hunter
```

---

## Costs

- **Digital Ocean Droplet**: $6/mo (Basic 1GB)
- **Helius**: Free tier (100k credits/day) or $49/mo for more
- **Supabase**: Free tier (500MB) or $25/mo for more
- **Total**: ~$6-80/mo depending on usage
