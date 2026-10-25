FROM apify/actor-python:3.12
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY main.py ./
CMD ["python3", "main.py"]
