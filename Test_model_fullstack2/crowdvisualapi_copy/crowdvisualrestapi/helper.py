import os
import csv
import pandas as pd
from django.utils.dateparse import parse_datetime
from .consts import building_dict, ap_dict
import re


# get appropriate CSV file
def get_csv(date, building=None):
    if building is None:
        path = os.path.abspath(os.path.join(os.getcwd(), "csv_data", "Sessions_Total"))
    else:
        print(building)
        path = os.path.abspath(os.path.join(os.getcwd(), "csv_data", f"Sessions_{building}"))


    for file in os.listdir(path):
        if file.endswith("_sessions_final.csv") and file[0:8] == date:
            return os.path.join(path, file)

    return "error"

# get campus occupancy by minute
def campus_occupancy(path, time, hour=False):
    '''
    Get occupancy of campus per room by minute

    returns a list of dictionaries per building occupied at specific minute
    '''
    with open(path, "r") as file:

        reader = csv.reader(file)
        next(reader)  # Skip header

        response = []
        
        temp_list = []

        lower_bound = float(time)
        upper_bound = float(time) + 59
        device_set = set()

        # Process only the first row after the header
        for row in reader:

            start = row[2].strip("[]").split(',')
            end = row[3].strip("[]").split(',')
            device_id = row[26]

            if row[36] not in building_dict:
                continue
            
            response_data = {}

            # if session does not have an access point connection at the minute, continue
            if hour is False:
                if int(start[0]) > int(time) or float(end[-1]) <= int(time):
                    continue
            else:
                if int(start[0]) > upper_bound or float(end[-1]) <= lower_bound:
                    continue
                if device_id in device_set:
                    continue


            # check if building is in temporary list
            # add new dictionary to response list if not
            if row[36] not in temp_list:

                response_data["date"] = row[32][:10]
                response_data["building"] = row[36]

                # add building coordinates
                response_data["building_lat"] = building_dict[row[36]][0]
                response_data["building_long"] = building_dict[row[36]][1]


                response_data["connection_count"] = 0

                # append dictionary to list
                # append building name to temporary list
                response.append(response_data)
                temp_list.append(row[36])
            device_set.add(device_id)

            # add temp dict
            for i in range(len(response)):
                if response[i]['building'] == row[36]:
                    response[i]["connection_count"] += 1
            
                        
    return response

# get building occupancy stats within hour 
# time parameter gives lower bound, upper bound is time + 59
def building_occupancy(path, building, time, hour=False):

    if building not in building_dict:
        return "Data unavailable"

    with open(path, "r") as file:
        reader = csv.reader(file)
        next(reader)  # Skip header

        device_set = set()
        time_arr = []
        
        lower_bound = float(time)
        upper_bound = float(time) + 59

        connection_count = 0

        max_floor = 0
        
        for row in reader:
            
            if row[36] != building:
                continue
            points = row[1].strip("[]").split(',')

            for p in points:
                ap = p.strip(" ' '")
                ap_name = ap.split("-")
                level = re.search(r'\d', ap_name[1])
                floor_level = int(level.group(0))
                
                if floor_level > max_floor:
                    max_floor = floor_level


            start = row[2].strip("[]").split(',')
            end = row[3].strip("[]").split(',')

            if hour is True:
                device_id = row[26]

                if int(start[0]) > upper_bound or float(end[-1]) <= lower_bound:
                    continue
                
                if float(start[0]) < lower_bound and float(end[-1]) > upper_bound:
                    time_arr.append(60.0)

                # device start time is lower than lower bound
                # subtract end time by lower bound to get total time
                elif (float(start[0]) < lower_bound):
                    t = float(end[-1]) - lower_bound
                    time_arr.append(t)

                # device start time is lower than lower bound
                # subtract end time by lower bound to get total time
                elif (float(end[-1]) > upper_bound):
                    t = upper_bound - float(start[0])
                    time_arr.append(t)

                #8 device start and end time is within bounds
                else:
                    time_arr.append(float(end[-1]) - float(start[0]))


                if device_id not in device_set:
                    connection_count += 1
                device_set.add(device_id)
            
            else:
                if int(start[0]) > int(time) or float(end[-1]) <= int(time):
                    continue
                else:
                    connection_count += 1


    if hour is True:
        # convert array to pandas series
        s = pd.Series(time_arr)
        
        # include relevant information in dict and return
        stats_dict = {
            'building': building,
            'building_lat': building_dict[building][0],
            'building_long': building_dict[building][1],
            'average': round(s.mean(),1),
            'standard_deviation': round(s.std(),1),
            'connection_count': connection_count,
            "no_floors": max_floor
        }
    else:
        stats_dict = {
            'building': building,
            'building_lat': building_dict[building][0],
            'building_long': building_dict[building][1],
            'connection_count': connection_count,
            "no_floors": max_floor
        }
    return stats_dict

def ap_occupancy(path, building, time, floor, hour=False):

    if building not in ap_dict:
        return "Data unavailable"


    with open(path, "r") as file:

        reader = csv.reader(file)
        next(reader)  # Skip header
        
        response = []
        temp_list = []
        device_set = set()

        # Process only the first row after the header
        for row in reader:
            if building != row[36]:
                continue
            count_rooms = int(row[0])
            rooms = row[1].strip("[]").split(',')
            start = row[2].strip("[]").split(',')
            end = row[3].strip("[]").split(',')
            device_id = row[26]
   
            
            response_data = {}
            
            for n in range(count_rooms):


                ap = rooms[n].strip(" ' '")
                ap_name = ap.split("-")
                level = re.search(r'\d', ap_name[1])
                floor_level = int(level.group(0))
                
                if hour is False:
                    if int(start[n]) > int(time) or float(end[n]) <= int(time):
                        continue
                else:
                    lower_bound = float(time)
                    upper_bound = float(time) + 59
                    if int(start[n]) > upper_bound or float(end[n]) <= lower_bound:
                        continue
                    
                    if device_id in device_set:
                        continue
                    
                

                
                if floor != floor_level:
                    continue
                
                if ap not in temp_list:

                    #print(row[36])
                    response_data["date"] = row[32][:10]
                    response_data["access_point"] = ap
                    #response_data["floor"] = floor.group(0)
                    
                    response_data["connection_count"] = 0
                    
                    if ap in ap_dict[building]:
                        response_data["building_lat"] = ap_dict[building][ap][0]
                        response_data["building_long"] = ap_dict[building][ap][1]
                    else:
                        #print(row[36])
                        response_data["building_lat"] = 0
                        response_data["building_long"] = 0
                        
                    #response[row[36]] = response_data
                    response.append(response_data)
                    temp_list.append(ap)
    
                device_set.add(device_id)

            

                
                for i in range(len(response)):
                    if response[i]['access_point'] == ap:
                        response[i]["connection_count"] += 1
                
    
    return response

def trajectory_csv_data(date):
    path = os.path.abspath(os.path.join(os.getcwd(), "csv_data", "Trajectory"))
    for file in os.listdir(path):
        if file.endswith("_finaltraj.csv"):
            return os.path.join(path, file)

    
    return "error"

def time_and_date(timestamp_str):
     # parse in ISO 8601

    timestamp = parse_datetime(timestamp_str)
    if timestamp is None:
        return "Invalid timestamp format"

    # Extract day, month, and year
    day = timestamp_str[8:10]
    month = timestamp_str[5:7]
    year = timestamp_str[0:4]

    # Format to YYYY
    date = year + month + day 
    time = timestamp.strftime('%H:%M')
    hours, minutes = map(int, time.split(':'))
    minutes_offset = hours * 60 + minutes

    return date, minutes_offset

def device_traj(path, user_id):
    with open(path, "r") as file:
        reader = csv.reader(file)
        next(reader)  # Skip header
        
        response = []

        for row in reader:
            if user_id != row[0]:
                continue

            traj_session = []
            traj = row[1].strip("[]").split(',')
            start = row[2].strip("[]").split(',')
            end = row[3].strip("[]").split(',')


            for n in range(len(traj)):
                building = traj[n].strip(" ' '")
                if float(end[n]) - float(start[n]) < 1:
                    continue
                if building != "UNKN":  
                    stay_time = {
                        "building": building,
                        "building_lat": building_dict[building][0],
                        "building_long": building_dict[building][1],
                        "start_time": convert(start[n]),
                        "end_time": convert(end[n]),
                        "total_time": float(end[n]) - float(start[n])
                    }
                    traj_session.append(stay_time)
            
            response.append(traj_session)
        
    return response


def convert(minutes_offset):
    # Total minutes are modulo 1440 to wrap around if greater than a day
    total_minutes = float(minutes_offset) % 1440
    
    # Calculate hours and minutes
    hours = int(total_minutes) // 60
    minutes = int(total_minutes) % 60
    
    # Determine AM/PM
    if hours >= 12:
        period = "pm"
        if hours > 12:
            hours -= 12
    else:
        period = "am"
        if hours == 0:
            hours = 12
    
    # Format the time string
    time_string = f"{hours}:{minutes:02d} {period}"
    
    return time_string

   



