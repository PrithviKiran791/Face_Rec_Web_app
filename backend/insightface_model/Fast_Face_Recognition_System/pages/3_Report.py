from pathlib import Path

import pandas as pd

from Home import face_rec
from Home import st
import datetime

LOG_KEY = 'attendance_logs'

st.set_page_config(page_title='Report', layout='wide')
st.subheader('Report')


def load_logs(name, end=-1):
    if face_rec.r is None:
        st.error('Redis connection not initialized')
        return []
    return face_rec.r.lrange(name, start=0, end=end)


def upload_simulated_logs(file_path, redis_key=LOG_KEY):
    if face_rec.r is None:
        return False, 'Redis is unavailable. Configure REDIS_HOST, REDIS_PORT and REDIS_PASSWORD first.'

    source = Path(file_path)
    if not source.exists():
        return False, f'File not found: {source}'

    logs = [line.strip() for line in source.read_text(encoding='utf-8').splitlines() if line.strip()]
    if not logs:
        return False, 'No log lines found in file.'

    face_rec.r.lpush(redis_key, *logs)
    return True, f'Pushed {len(logs)} simulated logs into {redis_key}.'


def parse_logs_to_dataframe(raw_logs):
    converted = [item.decode('utf-8') if isinstance(item, bytes) else str(item) for item in raw_logs]

    records = []
    for entry in converted:
        parts = entry.split('@')
        if len(parts) >= 3:
            name = parts[0].strip()
            role = parts[1].strip()
            timestamp = '@'.join(parts[2:]).strip()
            records.append({'Name': name, 'Role': role, 'TimeStamp': timestamp})

    if not records:
        return pd.DataFrame(columns=['Name', 'Role', 'TimeStamp'])

    logs_df = pd.DataFrame(records)
    # Normalize timestamps so both plain and fractional-second strings parse safely.
    logs_df['TimeStamp'] = logs_df['TimeStamp'].astype(str).str.split('.').str[0]
    logs_df['TimeStamp'] = pd.to_datetime(logs_df['TimeStamp'], errors='coerce')
    logs_df = logs_df.dropna(subset=['TimeStamp'])
    logs_df['Date'] = logs_df['TimeStamp'].dt.date
    logs_df['Time'] = logs_df['TimeStamp'].dt.time
    return logs_df


tab1, tab2, tab3 = st.tabs(['Registered Data', 'Logs', 'Attendance Report'])

with tab1:
    if st.button('Refresh data'):
        with st.spinner('Retrieving data from the Redis Database ......'):
            redis_face_db = face_rec.retrive_data(name='academy:register')
            st.dataframe(redis_face_db)
            st.success('Data Successfully Retrieved from the Redis Database')

with tab2:
    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button('Refresh Logs'):
            st.write('Loading logs from Redis Database...')
            st.write(load_logs(name=LOG_KEY))

    with col2:
        if st.button('Upload simulated_logs.txt to Redis'):
            ok, msg = upload_simulated_logs('simulated_logs.txt', redis_key=LOG_KEY)
            if ok:
                st.success(msg)
            else:
                st.error(msg)

with tab3:
    st.write('Attendance Report will be displayed here.')
    logs_list = load_logs(name=LOG_KEY)
    logs_df = parse_logs_to_dataframe(logs_list)

    if logs_df.empty:
        st.info('No valid logs available to build report.')
    else:
        report_df = logs_df.groupby(by=['Date', 'Name', 'Role']).agg(
            In_time=pd.NamedAgg(column='TimeStamp', aggfunc='min'),
            Out_time=pd.NamedAgg(column='TimeStamp', aggfunc='max')
        ).reset_index()

        report_df['In_time'] = pd.to_datetime(report_df['In_time']).dt.time
        report_df['Out_time'] = pd.to_datetime(report_df['Out_time']).dt.time
        report_df['Duration'] = (
            pd.to_datetime(report_df['Out_time'].astype(str))
            - pd.to_datetime(report_df['In_time'].astype(str))
        )

        st.dataframe(report_df)
        st.write(logs_df)
        #step 4:Marking Person is Present or Absent 

        all_dates = report_df['Date'].unique()
        name_roles = report_df[['Name','Role']].drop_duplicates().values.tolist()

        date_name_rol_zip = []
        for dt in all_dates:
            for name,role in name_roles:
                date_name_rol_zip.append((dt,name,role))

        date_name_rol_zip_df = pd.DataFrame(date_name_rol_zip, columns=['Date','Name','Role'])  

        #left join with report_df 

        date_name_rol_zip_df = pd.merge(
            date_name_rol_zip_df,
            report_df,
            on=['Date', 'Name', 'Role'],
            how='left',
            validate='one_to_one'
        )

        #Duration 
        #Hours 
        date_name_rol_zip_df['Duration_seconds'] = date_name_rol_zip_df['Duration'].dt.total_seconds()
        date_name_rol_zip_df['Duration_hours'] = date_name_rol_zip_df['Duration_seconds'] / 3600

        def status_marker(x):
            if pd.Series(x).isnull().all():
                return 'Absent'
            
            elif x > 0 and x < 1:
                return 'Absent (Less than 1 hour)'
            
            elif x >= 1 and x < 4:
                return 'Half Day (less than 4 hours)'
            
            elif x >=4 and x < 8:
                return 'Present'
            
        date_name_rol_zip_df['Status'] = date_name_rol_zip_df['Duration_hours'].apply(status_marker)

        st.dataframe(date_name_rol_zip_df)    


        st.write(date_name_rol_zip_df)

         #tab
        t1,t2 = st.tabs(['Complete Report','Filter Report'])

        with t1:
            st.subheader('Complete Report')
            st.dataframe(date_name_rol_zip_df)

        with t2:
            st.subheader('Search Records')

            # Date 
            date_in = str(st.date_input('Filter Date',datetime.date.today()))

            #Filter the person names 
            name_list = date_name_rol_zip_df['Name'].unique().tolist()
            name_in = st.selectbox('Select Name', options=['All'] + name_list)

            #Filter Teacher or Students(role)
            role_list = date_name_rol_zip_df['Role'].unique().tolist()
            role_in = st.selectbox('Select Role', options=['All'] + role_list)

            #Filter the duration 

            duration_in = st.slider('Filter by Duration (hours)', min_value=0.0, max_value=15.0, step=6.0)
            
            #Status 
            status_list = date_name_rol_zip_df['Status'].unique().tolist()
            status_in = st.multiselect('Select Status', ['All']+status_list)

            if st.button('Submit'):
                date_name_rol_zip_df['Date'] = date_name_rol_zip_df['Date'].astype(str)

                #fitler date 
                filter_df = date_name_rol_zip_df.query(f'Date == "{date_in}"')

                #filter the name 
                if name_in != 'All':
                    filter_df = filter_df.query(f'Name == "{name_in}"')

                #filter the role 
                if role_in != 'All':
                    filter_df = filter_df.query(f'Role == "{role_in}"')

                #filter the duration 
                filter_df = filter_df.query(f'Duration_hours >= {duration_in}')

                #filter the status 
                if 'All' not in status_in and len(status_in) > 0:
                    filter_df = filter_df[filter_df['Status'].isin(status_in)]

                st.dataframe(filter_df)

            st.write(date_in)
            st.write(name_in)
            st.write(role_in)
            st.write(duration_in)
            st.write(status_in)
