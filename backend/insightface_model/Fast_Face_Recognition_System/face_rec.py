import numpy as np
import pandas as pd
import cv2

import os
import redis
import time
import threading
from pathlib import Path

# insight face
from insightface.app import FaceAnalysis
from sklearn.metrics import pairwise
import datetime

REDIS_REGISTER_KEY = 'academy:register'
LOCAL_EMBEDDING_FILENAME = 'face_embeddings.txt'


def _load_local_env_file():
    env_path = Path(__file__).with_name('.env')
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue

        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if key and key not in os.environ:
            os.environ[key] = value


_load_local_env_file()

def _build_redis_client(hostname=None, port=None, password=None):
    if hostname is None:
        hostname = os.getenv('REDIS_HOST', 'localhost')
    if port is None:
        port = int(os.getenv('REDIS_PORT', '6379'))
    if password is None:
        password = os.getenv('REDIS_PASSWORD')

    try:
        client = redis.Redis(
            host=hostname,
            port=port,
            password=password,
            decode_responses=False # Keep False because you are handling .decode() manually in your function
        )
        client.ping()
        return client
    except Exception:
        return None


r = _build_redis_client()
redis_is_connected = r is not None

# Retrive Data from the Redis Database 

#Extract data from the database  
def retrive_data(name):
    if r is None:
        return pd.DataFrame(columns=['Name', 'Role', 'facial_feature'])

    # 1. Get the data directly (it's already a dict)
    retrive_dict = r.hgetall(name)
    
    # 2. Decode keys and values in one go to avoid the 'apply' overhead
    # This converts bytes to strings for keys and extracts name/role
    data_list = []
    for key, value in retrive_dict.items():  # pyright: ignore
        # key is b'Name@Role' or just 'Name'
        full_name_role = key.decode('utf-8')
        
        # Handle keys with or without '@' separator
        if '@' in full_name_role:
            name_part, role_part = full_name_role.split('@', 1)  # maxsplit=1 in case @ appears multiple times
        else:
            name_part = full_name_role
            role_part = 'Unknown'  # Default role if not specified
        
        # Convert binary value to numpy array
        feature = np.frombuffer(value, dtype=np.float32)
        
        data_list.append({
            'Name': name_part,
            'Role': role_part,
            'facial_feature': feature
        })
    
    # 3. Create the DataFrame directly from the list of dicts
    return pd.DataFrame(data_list)

# configure face analysis
faceapp = FaceAnalysis(name='buffalo_sc',root='insightface_model', providers = ['CPUExecutionProvider'])
faceapp.prepare(ctx_id = 0, det_size=(640,640), det_thresh = 0.5)

# ML Search Algorithm
def ml_search_algorithm(dataframe,feature_column,test_vector,
                        name_role=['Name','Role'],thresh=0.5):
    """
    cosine similarity base search algorithm
    """
    # step-1: take the dataframe (collection of data)
    dataframe = dataframe.copy()
    # step-2: Index face embeding from the dataframe and convert into array
    x_list = dataframe[feature_column].tolist()
    x = np.asarray(x_list)
    
    # step-3: Cal. cosine similarity
    similar = pairwise.cosine_similarity(x,test_vector.reshape(1,-1))
    similar_arr = np.array(similar).flatten()
    dataframe['cosine'] = similar_arr

    # step-4: filter the data
    data_filter = dataframe.query(f'cosine >= {thresh}')
    if len(data_filter) > 0:
        # step-5: get the person name
        data_filter.reset_index(drop=True,inplace=True)
        argmax = data_filter['cosine'].argmax()
        person_name, person_role = data_filter.loc[argmax][name_role]
        
    else:
        person_name = 'Unknown'
        person_role = 'Unknown'
        
    return person_name, person_role
## Real time prediction function
class RealTimePred:
    def __init__(self):
        self.logs = {'name': [], 'role': [], 'current_time': []}
    
    def reset_dict(self):
        self.logs = {'name': [], 'role': [], 'current_time': []}

    def save_logs_redis(self):
        if r is None:
            self.reset_dict()
            return

        #step-1: convert the dict into dataframe
        dataframe = pd.DataFrame(self.logs)
        if dataframe.empty:
            return

        #step-2: drop the duplicate information(distinct name)
        dataframe = dataframe.drop_duplicates('name')
        # step-3: push the data into the redis database
        #encode the data 
        name_list = dataframe['name'].tolist()
        role_list = dataframe['role'].tolist()
        ctime_list = dataframe['current_time'].tolist()
        encoded_data = []

        for name,role,ctime in zip(name_list,role_list,ctime_list):
            if name != 'Unknown':
                concat_string = f"{name}@{role}@{ctime}"
                encoded_data.append(concat_string)

        if len(encoded_data) > 0:
            r.lpush('attendance_logs', *encoded_data)

        self.reset_dict()

    def face_prediction(self, test_image, dataframe,feature_column,
                        name_role=['Name','Role'],thresh=0.5):
        test_copy = test_image.copy()
        current_time = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        cv2.putText(test_copy, current_time, (10, 30), cv2.FONT_HERSHEY_DUPLEX, 0.7, (255, 255, 255), 2)

        if dataframe is None or len(dataframe) == 0:
            return test_copy

        # step-1: take the test image and apply to insight face
        results = faceapp.get(test_image)
        # step-2: use for loop and extract each embedding and pass to ml_search_algorithm

        for res in results:
            x1, y1, x2, y2 = res['bbox'].astype(int)
            embeddings = res['embedding']
            person_name, person_role = ml_search_algorithm(dataframe,
                                                           feature_column,
                                                           test_vector=embeddings,
                                                           name_role=name_role,
                                                           thresh=thresh)
            if person_name == 'Unknown':
                color =(0,0,255) # bgr
            else:
                color = (0,255,0)

            cv2.rectangle(test_copy,(x1,y1),(x2,y2),color)

            text_gen = person_name
            cv2.putText(test_copy,text_gen,(x1,y1),cv2.FONT_HERSHEY_DUPLEX,0.7,color,2)
            cv2.putText(test_copy,current_time,(x1,y2),cv2.FONT_HERSHEY_DUPLEX,0.5,color,1)
            # save the logs in the dict
            self.logs['name'].append(person_name)
            self.logs['role'].append(person_role)
            self.logs['current_time'].append(current_time)

        return test_copy
####Registration form 
class RegistrationForm:
    def __init__(self):
        self.sample = 0
        self.last_capture_ts = 0.0
        self.last_inference_ts = 0.0
        self.face_embeddings = []
        self._lock = threading.Lock()

    def reset(self):
        with self._lock:
            self.sample = 0
            self.last_capture_ts = 0.0
            self.last_inference_ts = 0.0
            self.face_embeddings = []

    def sample_count(self):
        with self._lock:
            return self.sample

    def get_embeddings_copy(self):
        with self._lock:
            return list(self.face_embeddings)

    def get_embedding(self, frame, sample_interval=0.25, max_samples=30, inference_interval=0.12):
        now = time.monotonic()
        if (now - self.last_inference_ts) < inference_interval:
            return frame, self.sample_count()

        self.last_inference_ts = now
        #get results from insightface model 
        results = faceapp.get(frame,max_num=1)
        for res in results:
            x1,y1,x2,y2 = res['bbox'].astype(int)
            cv2.rectangle(frame,(x1,y1),(x2,y2),(0,255,0),1)
            #put text samples info 
            text = f"samples = {self.sample}/{max_samples}"
            cv2.putText(frame,text,(x1,y1),cv2.FONT_HERSHEY_DUPLEX,0.6,(0,255,0),2)

            should_collect = (
                self.sample < max_samples and
                (now - self.last_capture_ts) >= sample_interval
            )

            if should_collect:
                # Collect embeddings at a fixed cadence to avoid duplicate near-identical samples.
                embeddings = res['embedding']
                with self._lock:
                    self.face_embeddings.append(embeddings)
                    self.sample += 1
                    self.last_capture_ts = now

            if self.sample >= max_samples:
                cv2.putText(
                    frame,
                    'Sample target reached. Click Submit.',
                    (10, 60),
                    cv2.FONT_HERSHEY_DUPLEX,
                    0.6,
                    (0, 255, 255),
                    2
                )
        
        return frame, self.sample_count()

    def save_to_redis(self, name, role, face_embeddings=None, redis_key=REDIS_REGISTER_KEY):
        redis_client = r
        if redis_client is None:
            return False, 'Redis is unavailable. Check REDIS_HOST, REDIS_PORT and REDIS_PASSWORD.'

        if not name:
            return False, 'Name is required.'

        if face_embeddings is None:
            face_embeddings = self.get_embeddings_copy()

        if not face_embeddings:
            return False, 'No face embeddings collected. Keep your face in frame and try again.'

        x_array = np.asarray(face_embeddings, dtype=np.float32)
        x_mean = x_array.mean(axis=0)
        norm = np.linalg.norm(x_mean)
        if norm == 0:
            return False, 'Collected embeddings are invalid. Please recapture your face samples.'
        x_mean = x_mean / norm
        x_mean_bytes = x_mean.astype(np.float32).tobytes()

        redis_field = f'{name}@{role}'
        redis_client.hset(redis_key, redis_field, x_mean_bytes)
        self.reset()
        return True, f'{name} registered successfully.'

    def _normalized_mean_embedding(self, face_embeddings=None):
        if face_embeddings is None:
            face_embeddings = self.get_embeddings_copy()

        if not face_embeddings:
            return None, 'No face embeddings collected. Keep your face in frame and try again.'

        x_array = np.asarray(face_embeddings, dtype=np.float32)
        x_mean = x_array.mean(axis=0)
        norm = np.linalg.norm(x_mean)
        if norm == 0:
            return None, 'Collected embeddings are invalid. Please recapture your face samples.'
        return (x_mean / norm).astype(np.float32), None

    def save_local_embedding(self, name, role, directory='local_embeddings', file_format='npz', face_embeddings=None):
        if not name:
            return False, 'Name is required.', None

        embedding, err = self._normalized_mean_embedding(face_embeddings=face_embeddings)
        if embedding is None:
            return False, err, None

        os.makedirs(directory, exist_ok=True)
        safe_name = ''.join(ch if ch.isalnum() or ch in ('-', '_') else '_' for ch in name.strip())
        safe_role = ''.join(ch if ch.isalnum() or ch in ('-', '_') else '_' for ch in role.strip())
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')

        if file_format.lower() == 'npz':
            file_path = os.path.join(directory, f'{safe_name}_{safe_role}_{timestamp}.npz')
            np.savez(file_path, name=name, role=role, embedding=embedding)
            return True, f'Embedding saved to {file_path}', file_path

        if file_format.lower() == 'txt':
            file_path = os.path.join(directory, f'{safe_name}_{safe_role}_{timestamp}.txt')
            header = f'name={name},role={role}'
            np.savetxt(file_path, embedding.reshape(1, -1), fmt='%.8f', header=header, comments='# ')
            return True, f'Embedding saved to {file_path}', file_path

        return False, 'Unsupported file format. Use npz or txt.', None

    def _parse_txt_meta(self, first_line):
        name = ''
        role = ''
        if not first_line.startswith('#'):
            return name, role

        meta = first_line.lstrip('#').strip()
        for part in meta.split(','):
            item = part.strip()
            if item.startswith('name='):
                name = item.split('=', 1)[1].strip()
            elif item.startswith('role='):
                role = item.split('=', 1)[1].strip()
        return name, role

    def _load_npz_embedding(self, file_path):
        data = np.load(file_path, allow_pickle=False)
        name = str(data['name']) if 'name' in data else ''
        role = str(data['role']) if 'role' in data else ''
        embedding = np.asarray(data['embedding'], dtype=np.float32).flatten()
        if embedding.size == 0:
            return False, 'Embedding file is empty.', '', '', None
        return True, '', name, role, embedding

    def _load_txt_embedding(self, file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()

        name, role = self._parse_txt_meta(first_line)
        embedding = np.loadtxt(file_path, dtype=np.float32, comments='#')
        embedding = np.asarray(embedding, dtype=np.float32).flatten()
        if embedding.size == 0:
            return False, 'Embedding file is empty.', '', '', None
        return True, '', name, role, embedding

    def _load_embedding_from_file(self, file_path):
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.npz':
            return self._load_npz_embedding(file_path)
        if ext == '.txt':
            return self._load_txt_embedding(file_path)
        return False, 'Unsupported file extension. Use .npz or .txt.', '', '', None

    def push_local_embedding_to_redis(self, file_path, redis_key=REDIS_REGISTER_KEY, default_name=None, default_role='Student'):
        redis_client = r
        if redis_client is None:
            return False, 'Redis is unavailable. Check REDIS_HOST, REDIS_PORT and REDIS_PASSWORD.'

        ok, err, file_name, file_role, embedding = self._load_embedding_from_file(file_path)
        if not ok:
            return False, err

        name = ''
        if file_name:
            name = file_name.strip()
        elif default_name:
            name = default_name.strip()

        role = file_role.strip() if file_role else default_role
        if not name:
            return False, 'Name is missing in file metadata. Provide a default name before pushing to Redis.'

        if embedding is None:
            return False, 'Could not reead embedding values from file.'

        norm = np.linalg.norm(embedding)
        if norm == 0:
            return False, 'Embedding from file is invalid (zero norm).'
        embedding = (embedding / norm).astype(np.float32)

        redis_field = f'{name}@{role}'
        redis_client.hset(redis_key, redis_field, embedding.tobytes())  # pyright: ignore[reportArgumentType]
        return True, f'Loaded {os.path.basename(file_path)} and pushed {redis_field} to Redis.'
