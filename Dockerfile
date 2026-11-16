FROM python:3.12-slim
RUN pip install --no-cache-dir huggingface_hub==1.22.0 && useradd -m -u 1000 user
WORKDIR /app
ADD https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz /tmp/piper.tgz
ADD https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/cs/cs_CZ/jirka/medium/cs_CZ-jirka-medium.onnx /app/tts/cs_CZ-jirka-medium.onnx
ADD https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/cs/cs_CZ/jirka/medium/cs_CZ-jirka-medium.onnx.json /app/tts/cs_CZ-jirka-medium.onnx.json
RUN tar -xzf /tmp/piper.tgz -C /app/tts && rm /tmp/piper.tgz && chmod +x /app/tts/piper/piper
COPY index.html server.py hfsync.py ttspiper.py ttsseed.py wsrelay.py ./
RUN python ttsseed.py
COPY js ./js
RUN mkdir -p /app/data && chown -R user:user /app
USER user
ENV PJ_DATA=/app/data PJ_TRUST_PROXY=1 PYTHONUNBUFFERED=1 PORT=7860 HOME=/home/user
EXPOSE 7860
CMD ["python", "server.py"]
