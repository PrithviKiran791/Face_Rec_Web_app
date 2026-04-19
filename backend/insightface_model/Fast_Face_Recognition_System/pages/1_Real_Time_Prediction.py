from Home import st 
from Home import face_rec
from streamlit_webrtc import webrtc_streamer
import av
import time 

st.set_page_config(page_title='Real Time Prediction',layout='wide')
st.subheader('Real Time Prediction')

#Retrive the data from the redis database and covert into to dataframe
with st.spinner('Retrieving data from the Redis Database ......'):
     redis_face_db=face_rec.retrive_data(name='academy:register')
     if redis_face_db.empty:
         if face_rec.redis_is_connected:
             st.warning('Redis is connected, but no registered identities were found in academy:register. Add users in the Registration Form page first.')
         else:
             st.warning('Redis is unavailable. Set REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD as system environment variables, then restart Streamlit.')
     else:
         st.dataframe(redis_face_db)
         st.success('Data Successfully Retrieved from the Redis Database')

#time 
waitTime = 30 
setTime = time.time() + waitTime
realtimepred = face_rec.RealTimePred()
#Real time predicition code 
#streamlit webrtc 
def video_frame_callback(frame):
    global setTime

    img = frame.to_ndarray(format="bgr24")#3d array numpy array 
    #operations that you can perform on the img 
    pred_img = realtimepred.face_prediction(img,redis_face_db,'facial_feature',['Name','Role'],thresh=0.5)

    timenow = time.time()
    difftime = timenow - setTime 
    if difftime > waitTime:
        # realtimepred.saveLogs_redis()  # Method not found in RealTimePred class
        setTime = time.time() + waitTime #reset time 
        print('Saved Data to Redis Database')

    return av.VideoFrame.from_ndarray(pred_img, format="bgr24")


webrtc_streamer(key="realtimeprediction", video_frame_callback=video_frame_callback)


