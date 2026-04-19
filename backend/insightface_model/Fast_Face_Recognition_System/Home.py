import sys

# Check Python version - insightface and opencv2 are incompatible with Python 3.13
if sys.version_info < (3, 10) or sys.version_info >= (3, 11):
    print("ERROR: This application requires Python 3.10.x")
    print(f"Your current Python version is {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
    print("insightface and opencv2 are not compatible with Python versions higher than 3.10")
    sys.exit(1)

import streamlit as st

st.set_page_config(page_title='Attendance System',page_icon=':smiley:',layout='wide')

st.header('Attendance System Using face recognition')

with st.spinner('Loading Models and connecting to Redis Database ......'):
    import face_rec

st.success('Model loades successfully')

if face_rec.r is None:
    st.warning('Redis is unavailable. Configure the connection before starting Streamlit.')
else:
    st.success('Connected to Redis Database successfully')