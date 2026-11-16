# Pouštní jízda – obraz pro veřejný hosting (Railway apod.)
FROM python:3.12-slim
WORKDIR /app
# hlas spolujezdce: Piper (Linux) + český mužský hlas „jirka“ – stáhne se při sestavení obrazu
ADD https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz /tmp/piper.tgz
ADD https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/cs/cs_CZ/jirka/medium/cs_CZ-jirka-medium.onnx /app/tts/cs_CZ-jirka-medium.onnx
ADD https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/cs/cs_CZ/jirka/medium/cs_CZ-jirka-medium.onnx.json /app/tts/cs_CZ-jirka-medium.onnx.json
RUN tar -xzf /tmp/piper.tgz -C /app/tts && rm /tmp/piper.tgz && chmod +x /app/tts/piper/piper
COPY index.html server.py ./
COPY js ./js
# účty, žebříček, uložené hry a cache hlasu – na trvalý disk (volume připojený do /data)
ENV PJ_DATA=/data PJ_TRUST_PROXY=1 PYTHONUNBUFFERED=1
CMD ["python", "server.py"]
