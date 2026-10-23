package config

import (
	"errors"
	"strings"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	Port                string `env:"PORT" envDefault:"8080"`
	ListenHost          string `env:"LISTEN_HOST" envDefault:"127.0.0.1"`
	MaxUserStorageBytes int64  `env:"MAX_USER_STORAGE_BYTES" envDefault:"5368709120"`
	AdminUsername       string `env:"ADMIN_USERNAME" envDefault:"admin"`
	AdminPassword       string `env:"ADMIN_PASSWORD" envDefault:"aivro"`
	JWTSecret           string `env:"JWT_SECRET"`
	JWTExpireHours      int    `env:"JWT_EXPIRE_HOURS" envDefault:"168"`
	AppOrigin           string `env:"APP_ORIGIN"`
	AllowedOrigins      string `env:"ALLOWED_ORIGINS"`
	TrustedProxyCIDRs   string `env:"TRUSTED_PROXY_CIDRS" envDefault:"127.0.0.1/32,::1/128"`
	StorageDriver       string `env:"STORAGE_DRIVER" envDefault:"sqlite"`
	DatabaseDSN         string `env:"DATABASE_DSN" envDefault:"data/aivro.db"`
	LocalFileDir        string `env:"LOCAL_FILE_DIR" envDefault:"data/files"`
	LinuxDoAuthorizeURL string `env:"LINUX_DO_AUTHORIZE_URL" envDefault:"https://connect.linux.do/oauth2/authorize"`
	LinuxDoTokenURL     string `env:"LINUX_DO_TOKEN_URL" envDefault:"https://connect.linux.do/oauth2/token"`
	LinuxDoUserInfoURL  string `env:"LINUX_DO_USERINFO_URL" envDefault:"https://connect.linux.do/api/user"`
}

var Cfg Config

func Load() error {
	_ = godotenv.Load()
	if err := env.Parse(&Cfg); err != nil {
		return err
	}
	if len(strings.TrimSpace(Cfg.JWTSecret)) < 32 { return errors.New("JWT_SECRET 必须配置为至少 32 字节的随机密钥，所有实例需使用相同密钥") }
	if Cfg.MaxUserStorageBytes <= 0 { return errors.New("MAX_USER_STORAGE_BYTES 必须大于 0") }
	return nil
}
