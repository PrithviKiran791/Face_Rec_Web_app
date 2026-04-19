import av
import streamlit as st
import cv2
from streamlit_webrtc import webrtc_streamer
from Home import face_rec
import os
import tempfile


st.set_page_config(page_title='Registration Form',layout='wide')
st.subheader('Registration Form')
##init registration form 
if (
    'registration_form' not in st.session_state
    or not hasattr(st.session_state['registration_form'], 'sample_count')
    or not hasattr(st.session_state['registration_form'], 'save_local_embedding')
    or not hasattr(st.session_state['registration_form'], 'push_local_embedding_to_redis')
):
    st.session_state['registration_form'] = face_rec.RegistrationForm()

registration_form = st.session_state['registration_form']
sample_target = 200
#step-1: Collect person name and role 
#form 
person_name = st.text_input(label='Name',placeholder='Enter your first and last name')
role = st.selectbox(label='Select your Role',options=['Student','Teacher'])

#step-2: Collect the facial embedding of that person 
def video_callback(frame):
    img = frame.to_ndarray(format="bgr24")#3d array bgr
    reg_img, _ = registration_form.get_embedding(
        img,
        sample_interval=0.10,
        max_samples=sample_target
    )
    cv2.putText(reg_img, 'Position your face in the box', (10, 30), cv2.FONT_HERSHEY_DUPLEX, 0.7, (255, 255, 255), 2)
    return av.VideoFrame.from_ndarray(reg_img, format="bgr24")

webrtc_streamer(
    key='registration',
    video_frame_callback=video_callback,
    async_processing=True,
    media_stream_constraints={
        'video': {
            'width': {'ideal': 640},
            'height': {'ideal': 480},
            'frameRate': {'ideal': 15, 'max': 20}
        },
        'audio': False
    }
)
captured_samples = registration_form.sample_count()
progress_ratio = min(captured_samples / sample_target, 1.0)

st.markdown('### Capture Progress')
st.progress(progress_ratio)

progress_col_1, progress_col_2, progress_col_3 = st.columns(3)
progress_col_1.metric('Captured', f'{captured_samples}')
progress_col_2.metric('Remaining', f'{max(sample_target - captured_samples, 0)}')
progress_col_3.metric('Target', f'{sample_target}')

st.caption(f"Captured samples: {captured_samples}/{sample_target}")
if face_rec.r is not None:
    st.caption(f"Registered identities in Redis: {face_rec.r.hlen('academy:register')}")

#step-3: Save the data in

if st.button('Submit', key='submit_redis'):
    cleaned_name = person_name.strip()
    if not cleaned_name:
        st.error('Please enter a valid name.')
    elif registration_form.sample_count() < sample_target:
        st.error(f'Please capture at least {sample_target} samples before submitting.')
    else:
        status, message = registration_form.save_to_redis(
            name=cleaned_name,
            role=role,
            redis_key='academy:register'
        )
        if status:
            st.success(message)
        else:
            st.error(message)

st.markdown('### Save Facial Embedding Locally')
col_a, col_b = st.columns(2)
with col_a:
    if st.button('Save as NPZ (Local)', key='save_npz_local'):
        if not person_name.strip():
            st.error('Please enter name before saving locally.')
        elif registration_form.sample_count() < sample_target:
            st.error(f'Capture at least {sample_target} samples first.')
        else:
            ok, msg, _ = registration_form.save_local_embedding(
                name=person_name.strip(),
                role=role,
                directory='local_embeddings',
                file_format='npz'
            )
            if ok:
                st.success(msg)
            else:
                st.error(msg)

with col_b:
    if st.button('Save as TXT (Local)', key='save_txt_local'):
        if not person_name.strip():
            st.error('Please enter name before saving locally.')
        elif registration_form.sample_count() < sample_target:
            st.error(f'Capture at least {sample_target} samples first.')
        else:
            ok, msg, _ = registration_form.save_local_embedding(
                name=person_name.strip(),
                role=role,
                directory='local_embeddings',
                file_format='txt'
            )
            if ok:
                st.success(msg)
            else:
                st.error(msg)

st.markdown('### Load Local File and Push to Redis')
uploaded = st.file_uploader('Upload .npz or .txt embedding file', type=['npz', 'txt'])
fallback_name = st.text_input('Fallback Name (used when file metadata has no name)', value='')
fallback_role = st.selectbox('Fallback Role', options=['Student', 'Teacher'], index=0, key='fallback_role')

if st.button('Push Uploaded File to Redis', key='push_uploaded_redis'):
    if uploaded is None:
        st.error('Please upload a .npz or .txt file first.')
    else:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(uploaded.name)[1]) as tmp_file:
            tmp_file.write(uploaded.getbuffer())
            temp_path = tmp_file.name

        try:
            ok, msg = registration_form.push_local_embedding_to_redis(
                file_path=temp_path,
                redis_key='academy:register',
                default_name=fallback_name,
                default_role=fallback_role
            )
            if ok:
                st.success(msg)
            else:
                st.error(msg)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

if st.button('Reset Samples', key='reset_samples'):
    registration_form.reset()
    st.info('Samples reset. You can capture again.')