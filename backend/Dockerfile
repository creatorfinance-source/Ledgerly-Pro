FROM python:3.11-slim

# HF Spaces requires a non-root user with uid 1000
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Install deps first (better layer caching — only rebuilds when requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only the runtime source — no seed scripts, no dev files
COPY server.py auth.py models.py statements.py coa.py mock_psp.py ./
COPY db/ ./db/
COPY migrations/ ./migrations/

RUN chown -R appuser:appuser /app
USER appuser

# HF Spaces Docker containers must expose port 7860
EXPOSE 7860

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
