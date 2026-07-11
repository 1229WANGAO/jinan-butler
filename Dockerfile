# 济南管家企业微信后端 · 容器镜像
# 用法：任何支持 Docker 的平台（Render / Railway / Fly / 腾讯云 / 本地）均可一键运行
FROM node:20-alpine

WORKDIR /app

# 零第三方依赖，无需 npm install；直接拷贝源码
COPY package.json ./
COPY server.js ./
COPY index.html ./

# 消息落盘文件（不存在时后端会自动建空数组，这里放一个初始空文件）
RUN echo '[]' > messages.json

# 平台会通过环境变量 PORT 注入端口；本地默认 3001
# 云托管如需消息持久化：挂载「文件存储」到 /data 并设置环境变量 MSG_DIR=/data
EXPOSE 3000 3001

ENV NODE_ENV=production
CMD ["node", "server.js"]
