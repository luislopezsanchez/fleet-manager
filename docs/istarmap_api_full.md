# Istarmap API — Documentación consolidada


## readme

API Call Instructions
​

Global

All time formats in the API are yyyy-MM-ddTHH:mm:ssZ and in UTC timezone. Example: 2005-12-01T12:20:12Z.
Token is obtained from the login API response, type is bearer. Only a few APIs do not require token. The following APIs do not require TOKEN:
No.	API	Name
1	/dpms/file/{bucket}/	Get File
2	/dpms/verification_code/send	Send Verification Code
3	/dpms/verification_code/password	Reset Password
4	/dpms/device/icon_config/list	Device Icon List
Other Notes Reference Device status and icons

Status in GpsTrackVo

ACC Status . When bit 0 of the mask1 is set to 1, take bit 0 of status1.

Alarm ID Description

Alarm ID	Description	Remarks
1017	External Power Low Battery Alarm	
1018	External Power Disconnect Alarm	
1020	Built-in Battery Low Battery Alarm	
1021	GPS Antenna Removal Alarm	
1022	Overspeed Alarm	
1025	Geo-fence Exit Alarm	
1026	Geo-fence Entry Alarm	
1027	GPS Signal Loss Event	
1033	Device Shutdown Alarm	
1035	Trailer Alarm	
1038	Idling Alarm	
1039	Harsh Acceleration Alarm	
1040	Harsh Turning Alarm	
1041	Harsh Turning Alarm	
1042	Impact/Collision Alarm	
1043	Fatigue Driving Alarm	
1045	Overtime Driving Alarm	
1046	High Temperature Alarm	
1047	Low Temperature Alarm	
1048	Fuel Theft Alarm	
1049	Low Fuel Alarm	
1050	GSM Interference Alarm	
1052	Vehicle Theft Alarm	
1055	Device Removal Alarm	
1056	Diagnostic Trouble Code Alarm	
1057	Low Speed Alarm	
1059	Refueling Alarm	
1060	Gps Jamming Alarm	
1128	Vibration Alarm	
1129	SIM Card Change Alarm	
1130	Low Battery Shutdown Alarm	
2000	SOS Alarm	
2001	Insufficient Rest Alarm	
2002	Exceed Driving Time	
2003	Door Open	
2004	Door Close	
2005	ACC On	
2006	ACC Off	
2007	Dangerous Driving	
2008	Malfunction Alarm	
2009	GNSS Short Circuit Alarm	
2010	LCD Fault Alarm	
2011	TIS Module Fault Alarm	
2012	Camera Fault Alarm	
2013	Insufficient Driving Time	
2014	Card Module Fault Alarm	
2015	Illegal Driving Alarm	
2016	Overtime Parking Alarm	
2017	Vehicle VSS Fault	
1099	Offline Alarm	
2050	Bracelet Removal Alarm	
2051	Fall Detection Alarm	
2052	Abnormal Heart Rate Alarm	
2053	High Humidity	
2054	Low Humidity	

## login

Login/Get T0KEN
​

Endpoint /auth/oauth/token

Request Method POST

consumes ``

produces ["*/*"]

Description In this API, you can use parameters such as username and password to get a token. The password field uses AES+BASE64 encryption algorithm AES parameters: 128-bit CBC ZeroPadding Key: 1234567812345678 IV: 1234567812345678 Below is an example: Aa123456 can be encrypted into 3fQh2d7AdkIvwSsAQ1Y29w==.

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
client_id	Client ID (This value is "third")	query	true	string	
client_secret	Client secret (This value is "89765423")	query	true	string	
grant_type	Fixed as "password"	query	true	string	
username	Username	formdata	true	string	
password	Password	formdata	true	string	

Response Status

Status Code	Description	Schema
200	OK	
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
access_token	TOKEN	String	String
token_type	Fixed as bearer	String	String
user_info	User information	UserInfoVO	UserInfoVO

Schema Property Description

UserInfoVO

Parameter Name	Description	Type	Schema
username	Username	string	
id	User ID, use this for logged-in user ID	string	
roleCode	Customer type	string	
timeZone	Time zone	string	
avatar	Avatar/Icon	string	
deviceId	Device ID, valid when roleCode is ROLE_IMEI	number	
orgId	Agent/Regular User/Monitoring User/Virtual Account ID	number	

roleCode

Definition	Description
ROLE_ORG	Agent, all permissions including operations management, device monitoring
ROLE_GENERAL	Regular User, device monitoring, can modify some device information
ROLE_MONITOR	Monitoring User, device monitoring, cannot modify device information
ROLE_VIRTUAL	Virtual Account for demonstration, read-only, no device operation permissions
ROLE_IMEI	IMEI individual customer, device ID taken from deviceId in UserInfoVO

Response Example

json
{
    "access_token": "s8F5GdPvm3oq2oBSbPyavTmtQfE",
    "token_type": "bearer",
    "user_info": {
        "username": "istartek",
        "id": 552,
        "orgId": 998,
        "deviceId": null,
        "avatar": "/dpms/file/istartek-gps/b2646691e6e74aa3904d0a771e8f89de.jpg",
        "roleCode": "ROLE_ORG",
        "timeZone": "UTC+08:00"
    }
}

FAQ

How to use TOKEN？

You can put the token in the header of the HTTP request. For example: 'authorization: bearer e6l8qVp9gdDYTS76MA9ZvOy6xdg'。

## logout

Logout
​

Endpoint /auth/token/logout

Request Method DELETE

consumes ``

produces ["*/*"]

Description User logout system

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	

Response Status

Status Code	Description	Schema
200	OK	
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data		
msg	Return message	string	

Schema Property Description

None

Response Example

json
{
    "code": 0,
    "msg": "",
    "data": true
}

## car_status

[file content begin]

Device Status and Device Icon Status Description
​

Icon Precondition Interface Description

Platform vehicle custom icons must first call the /dpms/device/icon_config/list API to cache locally for subsequent use. The name field of the API response corresponds to the subsequent iconName field. (If cached locally, a refresh mechanism is needed. Vehicle icons generally do not change.)
Monitoring Page Logic:
​
The monitoring page by default calls the device group API tapi/group/device?orgId=1234 to get device group data.
The 10-second refresh needs to call the /tapi/tracker API to refresh positioning data.
Vehicle Status Calculation Rules:
​

Description of status-related fields

mask1 Status 1 corresponding mask. The status exists only if the mask bit is true. It is a 32-bit field and needs to be converted to binary for use.
status1 is Status 1, a 32-bit field that needs to be converted to binary for use. For detailed description, refer to the status attachment (ACC is the first field after conversion).
userDue User expiration time.
platformDue Platform expiration time.
overSpeed The overspeed threshold configured for the device.
serverTime The current time returned by the server.
Vehicle Status Description
​
Inactive: If the newGpsTrack field in the group API response is empty, or if there is no activeTime field.
Expired: If either the userDue or platformDue field is less than or equal to the current time, the device is expired.
Overspeeding: If overSpeed is configured and the device speed speed >= overSpeed, it is in an overspeeding state.
Moving: If the speed speed > 0 and it is not overspeeding, it is in a moving state.
ACC On & Stationary: The device's ACC is on, and the device is stationary (speed = 0).
Stationary: The device's ACC is not enabled, and the device is stationary (speed = 0).
Offline: If the last online time satisfies serverTime - lastOnlineTime >= 10 minutes, the device is offline.
Status Word Calculation Method
​

status1, status2 and mask1, mask2 fields require binary processing to get the value of the corresponding bit.

Reference processing flow: First convert the number to binary, then split it into an array, and then reverse the array.

JS syntax example
js
// 32-bit conversion value explanation: First convert the number to binary, then split into an array, then reverse the array
// Reversal is because index 0 corresponds to the last bit of the binary number
// Status 1 corresponding mask, the status exists only if the mask bit is true
const mask1 = gpsInfo.mask1?.toString(2)?.split('')?.reverse() || []
const status1 = gpsInfo.status1?.toString(2)?.split('')?.reverse() || []

/**
 * Get status bit value
 * @status status1 Processed binary bit array
 * @masks mask1 Processed binary bit array  
 * @index The index corresponding to the status
 */
export function formatByteStatus(status, masks, index){
  return +masks[index] === 1 ? +status[index] : '-'
}
// Because ACC is the 0th bit (index 0) of the status1 binary, so pass parameter 0
const acc = formatByteStatus(status1, mask1, 0)

## get_org_tree

User Organization Tree
​

Endpoint /dpms/org/tree

Request Method GET

consumes ``

produces ["*/*"]

Description User organization tree

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
orgId	Organization ID	query	false	integer	

Response Status

Status Code	Description	Schema
200	OK	R«List«OrgTree»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	OrgTree
msg	Return message	string	

Schema Property Description

OrgTree

Parameter Name	Description	Type	Schema
children	Child node list	array	TreeNode
createTime	Creation time	string(date-time)	
deviceQuantity1	Device quantity 1 (excluding sub-organizations)	integer(int32)	
deviceQuantity2	Device quantity 2 (including sub-organizations)	integer(int32)	
fullParent	Parent path	array	
id	Current node ID	integer(int64)	
orgCode	Organization code	string	
orgName	Organization name	string	
orgType	Organization type (Available values: DEALER,GENERAL,VIRTUAL,MONITOR,IMEI)	string	
parentId	Parent node ID	integer(int64)	
userId	User ID	integer(int64)	

TreeNode

Parameter Name	Description	Type	Schema
children	Child node list	array	TreeNode
id	Current node ID	integer(int64)	
parentId	Parent node ID	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"children": [
				{
					"children": [
						{
							"children": [
								{}
							],
							"id": 0,
							"parentId": 0
						}
					],
					"id": 0,
					"parentId": 0
				}
			],
			"createTime": "",
			"deviceQuantity1": 0,
			"deviceQuantity2": 0,
			"fullParent": [],
			"id": 0,
			"orgCode": "",
			"orgName": "",
			"orgType": "",
			"parentId": 0,
			"userId": 0
		}
	],
	"msg": ""
}

## group_device_with_gps

Group Device List with GPS Information
​

Endpoint /tapi/group/device

Request Method GET

consumes ``

produces ["*/*"]

Description Group device list with GPS information

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
orgId	orgId	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«List«GroupVO»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GroupVO
msg	Return message	string	

Schema Property Description

GroupVO

Parameter Name	Description	Type	Schema
deviceList	Device list	array	DeviceBaseInfoWithGpsInfoVo
groupName	Group name	string	
id	ID (-1 represents default group)	integer(int64)	

DeviceBaseInfoWithGpsInfoVo

Parameter Name	Description	Type	Schema
activeTime	Activation time	string(date-time)	
avatar	Vehicle image	string	
canLogin	Whether can login separately	boolean	
carVin	Vehicle VIN number	string	
cardTypeId	Card type (CARD_TYPE_IMPORT_YEAR. One-year import card, CARD_TYPE_CONTINUE_YEAR: One-year renewal card, CARD_TYPE_ALL: Lifetime card, CARD_TYPE_TRY: Trial card)	string	
deviceName	Device name	string	
deviceType	Device type	string	
deviceVideoSetting	Camera settings	DeviceVideoSetting	DeviceVideoSetting
doorSetting	Door settings	DeviceDoorSetting	DeviceDoorSetting
driveCardNo	Driver ID card number	string	
driverName	Driver name	string	
extendInfo	Extended information	DeviceExtendInfo	DeviceExtendInfo
fuelValue	Fuel consumption	number(float)	
iccid	ICCID number	string	
icon	Device icon (1. Marker 2. Person 3. Pet 4. Cat 5. Dog)	integer(int32)	
iconName	Device icon English name	string	
id	Primary Key , Aliases 'vid' and 'deviceId' are used in other interfaces.	integer(int64)	
imei	Device IMEI number	string	
importTime	Import time	string(date-time)	
lastOnlineTime	Last online time	string(date-time)	
mobile	Contact mobile number	string	
newGpsTrack		GpsTrackVo	GpsTrackVo
obdSupportFlag	Whether supports OBD	boolean	
org	Belonging customer	OrgVO	OrgVO
overSpeed	Overspeed threshold	number(float)	
plateNo	License plate number	string	
platformDue	Platform expiration time	string(date-time)	
saleTime	Sales date	string(date-time)	
serverFlag	1: Lifetime 0: Non-lifetime	integer(int32)	
sim	SIM card number	string	
tireSetting	Tire pressure information	DeviceTireSetting	DeviceTireSetting
userDue	User expiration time	string(date-time)	
userId	User ID	integer(int64)	

DeviceVideoSetting

Parameter Name	Description	Type	Schema
videoInfos		array	VideoInfo

VideoInfo

Parameter Name	Description	Type	Schema
id		integer(int32)	
name		string	

DeviceDoorSetting

Parameter Name	Description	Type	Schema
doors		array	DeviceDoorInfo

DeviceDoorInfo

Parameter Name	Description	Type	Schema
flag	Door flag (Available values: LF,LB,RF,RB,BD)	string	
id	Bluetooth ID	string	

DeviceExtendInfo

Parameter Name	Description	Type	Schema
obdProtocolType	Available values: CAN_11_500,CAN_11_250,CAN_29_500_EX,CAN_11_29_250_EX,KWP2000,KWP2000M,ISO9141,VPW,PWM,PRIVATE,J1939,OTHER	string	

GpsTrackVo

Parameter Name	Description	Type	Schema
adVoltages	AD voltage values, ID is sequence number, VALUE is value: unit 0.01V	array	IdValueDto
alcoholSensors	Alcohol sensor data	array	AlcoholSensorDto
altitude	Altitude 0.1m	integer(int32)	
angle	Moving direction angle	number(double)	
batVoltage	Internal battery voltage value unit: 0.01V	integer(int32)	
csqQuantity	GSM signal value	integer(int32)	
deviceName	Device name	string	
doorSensors	Door sensor data	array	DoorSensorDto
extVoltage	External power voltage value unit: 0.01V	integer(int32)	
fuelLiters	Fuel quantity, ID is sequence number, VALUE is value: unit 0.1L	array	IdValueDto
gpsTime	GPS time	string(date-time)	
hdop	Horizontal dilution of precision	number(double)	
heartRateSensors	Heart rate sensor data	array	HeartRateSensorDto
imei	IMEI number	string	
lastOnlineTime	Last online time	string(date-time)	
lastStayTime	Last stay time	string(date-time)	
lat	Latitude	number	
lon	Longitude	number	
mask1	Mask 1	integer(int32)	
mask2	Mask 2	integer(int32)	
mask3	Mask 3	integer(int32)	
mask4	Mask 4	integer(int32)	
mask5	Mask 5	integer(int32)	
mask6	Mask 6	integer(int32)	
mask7	Mask 7	integer(int32)	
mask8	Mask 8	integer(int32)	
obdData	OBD data	ObdDataDto	ObdDataDto
obdFault	OBD fault	ObdFaultDto	ObdFaultDto
odometer	Accumulated total mileage, unit meter	integer(int32)	
photo	Photo data	PhotoDto	PhotoDto
preTracks	Recent tracking轨迹	array	GpsTrackVo
quantity	Number of satellite signals received	integer(int32)	
speed	Speed m/hour	integer(int32)	
speedSensors	Speed sensor data	array	SpeedSensorDto
status1	Status 1	integer(int32)	
status2	Status 2	integer(int32)	
status3	Status 3	integer(int32)	
status4	Status 4	integer(int32)	
status5	Status 5	integer(int32)	
status6	Status 6	integer(int32)	
status7	Status 7	integer(int32)	
status8	Status 8	integer(int32)	
swipeInfo	Clock-in information	GpsSwipeInfoVo	GpsSwipeInfoVo
tempSensors	Sensor temperature, ID is sequence number, VALUE is value: unit 0.1°C	array	TemperatureDto
tirePressureSensors	Tire pressure sensor data	array	TirePressureSensorDto
validity	Whether valid	boolean	
vid	Device ID	integer(int64)	
warnFlag1	Alarm word 1	integer(int32)	
warnFlag2	Alarm word 2	integer(int32)	
warnMask1	Alarm word mask 1	integer(int32)	
warnMask2	Alarm word mask 2	integer(int32)	
watchInfo	Watch related information	WatchInfo	WatchInfo

IdValueDto

Parameter Name	Description	Type	Schema
attribute	Other attributes	object	
id	Sequence number	string	
value	Value	integer(int32)	

AlcoholSensorDto

Parameter Name	Description	Type	Schema
alcoholConcentration	Alcohol concentration	integer(int32)	
id	Index	string	
useTime	Use time	integer(int32)	

DoorSensorDto

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	integer(int32)	
flag	Door flag (Available values: LF,LB,RF,RB,BD)	string	
id	Bluetooth index	string	
status	Status 1: Open 0: Close	integer(int32)	

HeartRateSensorDto

Parameter Name	Description	Type	Schema
heartRate	Heart rate	integer(int32)	
id	Index	string	
respiratoryRate	Respiratory rate	integer(int32)	

ObdDataDto

Parameter Name	Description	Type	Schema
ambientTemp	Ambient temperature ℃	number(double)	
aps	Accelerator pedal position %	number(double)	
atmoPress	Atmospheric pressure kPa	integer(int32)	
coolantTemp	Coolant temperature Engine coolant temperature. Unit: ℃	number(double)	
defaultNum	Fault code count	integer(int32)	
defaultOdometer	Fault mileage Km	integer(int32)	
defaultStatus	Fault code status "0" means not lit, "1" means lit	integer(int32)	
engineLoad	Engine load percentage. Unit: %	number(double)	
fuelLevel	Fuel level 35L means remaining 35L fuel	string	
fuelPressure	Fuel pressure kPa %	integer(int32)	
gpsTime	GPS time	string(date-time)	
iaa	First cylinder ignition timing advance angle %	number(double)	
instantFuel	Instantaneous fuel consumption Unit: L/h	number(double)	
intakePressure	Intake pressure Unit: kPa	number(double)	
intakeTemp	Intake temperature Unit: ℃	number(double)	
ltf	Long term fuel trim (Bank 1 and 3) %	number(double)	
mafFlow	Mass air flow Unit: g/s	number(double)	
rpm	Engine speed RPM Unit: r/min	integer(int32)	
speed	Vehicle speed Km/h	integer(int32)	
startSec	Time since engine start sec	integer(int32)	
throttle	Throttle position Unit: %	number(double)	

ObdFaultDto

Parameter Name	Description	Type	Schema
code	Code	string	
gpsTime	GPS time	string(date-time)	
lat	Latitude	number(double)	
lon	Longitude	number(double)	
status	Status	integer(int32)	
type	Type	string	
vid	Device ID	integer(int64)	

PhotoDto

Parameter Name	Description	Type	Schema
cid	Channel ID	integer(int32)	
name	Image name	string	
photoTime	GPS time	string(date-time)	
vid	Device ID	integer(int64)	

SpeedSensorDto

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	integer(int32)	
id	Index	string	
odometer	Mileage meter	integer(int32)	
rpm	RPM, unit 0.1rpm	integer(int32)	
speed	Speed m/hour	integer(int32)	
turnFlag	true-forward, 1-reverse	boolean	

GpsSwipeInfoVo

Parameter Name	Description	Type	Schema
cardName	ID name	string	
cardNo	Card number	string	
gpsTime	GPS time	string(date-time)	
lat	Longitude	number	
lon	Latitude	number	

TemperatureDto

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	integer(int32)	
humidity	Humidity, percentage	integer(int32)	
id	Index	string	
temperature	Temperature, unit 0.1 degree	integer(int32)	

TirePressureSensorDto

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	integer(int32)	
id	Index	string	
pressure	Pressure: 0.1Kpa	integer(int32)	
status	Status 00 - Normal, 01 - Leakage, 02 - Inflating, 03 - Starting (tire rotating), 04 - Power on (sensor first power on)	integer(int32)	
temperature	Temperature: 0.1 degree	integer(int32)	
tireInfoId	Tire pressure ID	integer(int32)	

WatchInfo

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	string	
rolling	Rollover count	string	
step	Step count	string	

OrgVO

Parameter Name	Description	Type	Schema
avatar	Avatar	string	
contactAddress	Contact address	string	
contacts	Contact person	string	
createTime	Creation time	string(date-time)	
deviceQuantity1	Device quantity 1 (excluding sub-customers)	integer(int32)	
deviceQuantity2	Device quantity 2 (including sub-customers)	integer(int32)	
fullParent	Parent ID	array	
id	Organization ID	integer(int64)	
mobilePhone	Contact mobile	string	
orgCode	Organization code, also user account	string	
orgEmail	Email	string	
orgName	Customer name	string	
orgType	Type. Dealer: DEALER, General: GENERAL, Virtual organization: VIRTUAL, Monitor: MONITOR	string	
parentOrg	Parent organization	OrgVO	OrgVO
remark	Remarks	string	
telephone	Contact telephone	string	
timeZoneId	Time zone ID	integer(int64)	
userId	User ID	integer(int64)	
website	Website	string	

DeviceTireSetting

Parameter Name	Description	Type	Schema
tireNum	Tire quantity	integer(int32)	
tires		array	DeviceTireInfo

DeviceTireInfo

Parameter Name	Description	Type	Schema
id	Bluetooth ID	string	
name	Custom name	string	
tireId	Tire ID	integer(int32)	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"deviceList": [
				{
					"activeTime": "",
					"avatar": "",
					"canLogin": true,
					"carVin": "",
					"cardTypeId": "",
					"deviceName": "",
					"deviceType": "",
					"deviceVideoSetting": {
						"videoInfos": [
							{
								"id": 0,
								"name": ""
							}
						]
					},
					"doorSetting": {
						"doors": [
							{
								"flag": "",
								"id": ""
							}
						]
					},
					"driveCardNo": "",
					"driverName": "",
					"extendInfo": {
						"obdProtocolType": ""
					},
					"fuelValue": 0,
					"iccid": "",
					"icon": 0,
					"iconName": "",
					"id": 0,
					"imei": "",
					"importTime": "",
					"lastOnlineTime": "",
					"mobile": "",
					"newGpsTrack": {
						"adVoltages": [
							{
								"attribute": {},
								"id": "",
								"value": 0
							}
						],
						"alcoholSensors": [
							{
								"alcoholConcentration": 0,
								"id": "",
								"useTime": 0
							}
						],
						"altitude": 0,
						"angle": 0,
						"batVoltage": 0,
						"csqQuantity": 0,
						"deviceName": "",
						"doorSensors": [
							{
								"eleQuantity": 0,
								"flag": "",
								"id": "",
								"status": 0
							}
						],
						"extVoltage": 0,
						"fuelLiters": [
							{
								"attribute": {},
								"id": "",
								"value": 0
							}
						],
						"gpsTime": "",
						"hdop": 0,
						"heartRateSensors": [
							{
								"heartRate": 0,
								"id": "",
								"respiratoryRate": 0
							}
						],
						"imei": "",
						"lastOnlineTime": "",
						"lastStayTime": "",
						"lat": 0,
						"lon": 0,
						"mask1": 0,
						"mask2": 0,
						"mask3": 0,
						"mask4": 0,
						"mask5": 0,
						"mask6": 0,
						"mask7": 0,
						"mask8": 0,
						"obdData": {
							"ambientTemp": 0,
							"aps": 0,
							"atmoPress": 0,
							"coolantTemp": 0,
							"defaultNum": 0,
							"defaultOdometer": 0,
							"defaultStatus": 0,
							"engineLoad": 0,
							"fuelLevel": "",
							"fuelPressure": 0,
							"gpsTime": "",
							"iaa": 0,
							"instantFuel": 0,
							"intakePressure": 0,
							"intakeTemp": 0,
							"ltf": 0,
							"mafFlow": 0,
							"rpm": 0,
							"speed": 0,
							"startSec": 0,
							"throttle": 0
						},
						"obdFault": {
							"code": "",
							"gpsTime": "",
							"lat": 0,
							"lon": 0,
							"status": 0,
							"type": "",
							"vid": 0
						},
						"odometer": 0,
						"photo": {
							"cid": 0,
							"name": "",
							"photoTime": "",
							"vid": 0
						},
						"preTracks": [
							{}
						],
						"quantity": 0,
						"speed": 0,
						"speedSensors": [
							{
								"eleQuantity": 0,
								"id": "",
								"odometer": 0,
								"rpm": 0,
								"speed": 0,
								"turnFlag": true
							}
						],
						"status1": 0,
						"status2": 0,
						"status3": 0,
						"status4": 0,
						"status5": 0,
						"status6": 0,
						"status7": 0,
						"status8": 0,
						"swipeInfo": {
							"cardName": "",
							"cardNo": "",
							"gpsTime": "",
							"lat": 0,
							"lon": 0
						},
						"tempSensors": [
							{
								"eleQuantity": 0,
								"humidity": 0,
								"id": "",
								"temperature": 0
							}
						],
						"tirePressureSensors": [
							{
								"eleQuantity": 0,
								"id": "",
								"pressure": 0,
								"status": 0,
								"temperature": 0,
								"tireInfoId": 0
							}
						],
						"validity": true,
						"vid": 0,
						"warnFlag1": 0,
						"warnFlag2": 0,
						"warnMask1": 0,
						"warnMask2": 0,
						"watchInfo": {
							"eleQuantity": "",
							"rolling": "",
							"step": ""
						}
					},
					"obdSupportFlag": true,
					"org": {
						"avatar": "",
						"contactAddress": "",
						"contacts": "",
						"createTime": "",
						"deviceQuantity1": 0,
						"deviceQuantity2": 0,
						"fullParent": [],
						"id": 0,
						"mobilePhone": "",
						"orgCode": "",
						"orgEmail": "",
						"orgName": "",
						"orgType": "",
						"parentOrg": {
							"avatar": "",
							"contactAddress": "",
							"contacts": "",
							"createTime": "",
							"deviceQuantity1": 0,
							"deviceQuantity2": 0,
							"fullParent": [],
							"id": 0,
							"mobilePhone": "",
							"orgCode": "",
							"orgEmail": "",
							"orgName": "",
							"orgType": "",
							"parentOrg": {},
							"remark": "",
							"telephone": "",
							"timeZoneId": 0,
							"userId": 0,
							"website": ""
						},
						"remark": "",
						"telephone": "",
						"timeZoneId": 0,
						"userId": 0,
						"website": ""
					},
					"overSpeed": 0,
					"plateNo": "",
					"platformDue": "",
					"saleTime": "",
					"serverFlag": 0,
					"sim": "",
					"tireSetting": {
						"tireNum": 0,
						"tires": [
							{
								"id": "",
								"name": "",
								"tireId": 0
							}
						]
					},
					"userDue": "",
					"userId": 0
				}
			],
			"groupName": "",
			"id": 0
		}
	],
	"msg": ""
}

## device_all

Device Simple Information List
​

Endpoint /dpms/device/all

Request Method GET

consumes ``

produces ["*/*"]

Description Device list

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
orgId	Organization ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«List«DeviceBaseInfoSimpleVO»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	DeviceBaseInfoSimpleVO
msg	Return message	string	

Schema Property Description

DeviceBaseInfoSimpleVO

Parameter Name	Description	Type	Schema
activeTime	Activation time	string(date-time)	
avatar	Vehicle image	string	
canLogin	Whether can login separately	boolean	
carVin	Vehicle VIN number	string	
cardTypeId	Card type (CARD_TYPE_IMPORT_YEAR. One-year import card, CARD_TYPE_CONTINUE_YEAR: One-year renewal card, CARD_TYPE_ALL: Lifetime card, CARD_TYPE_TRY: Trial card)	string	
deviceName	Device name	string	
deviceType	Device type	string	
deviceVideoSetting	Camera settings	DeviceVideoSetting	DeviceVideoSetting
driveCardNo	Driver ID card number	string	
driverName	Driver name	string	
fuelValue	Fuel consumption	number(float)	
iccid	ICCID number	string	
icon	Device icon (1. Marker 2. Person 3. Pet 4. Cat 5. Dog)	integer(int32)	
iconName	Device icon English name	string	
id	Primary Key	integer(int64)	
imei	Device IMEI number	string	
importTime	Import time	string(date-time)	
lastOnlineTime	Last online time	string(date-time)	
obdSupportFlag	Whether supports OBD	boolean	
overSpeed	Overspeed threshold	number(float)	
plateNo	License plate number	string	
platformDue	Platform expiration time	string(date-time)	
saleTime	Sales date	string(date-time)	
serverFlag	1: Lifetime 0: Non-lifetime	integer(int32)	
sim	SIM card number	string	
userDue	User expiration time	string(date-time)	
userId	User ID	integer(int64)	

DeviceVideoSetting

Parameter Name	Description	Type	Schema
videoInfos	Camera information	array	VideoInfo

VideoInfo

Parameter Name	Description	Type	Schema
id	Camera	integer(int32)	
name	Camera name	string	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"activeTime": "",
			"avatar": "",
			"canLogin": true,
			"carVin": "",
			"cardTypeId": "",
			"deviceName": "",
			"deviceType": "",
			"deviceVideoSetting": {
				"videoInfos": [
					{
						"id": 0,
						"name": ""
					}
				]
			},
			"driveCardNo": "",
			"driverName": "",
			"fuelValue": 0,
			"iccid": "",
			"icon": 0,
			"iconName": "",
			"id": 0,
			"imei": "",
			"importTime": "",
			"lastOnlineTime": "",
			"obdSupportFlag": true,
			"overSpeed": 0,
			"plateNo": "",
			"platformDue": "",
			"saleTime": "",
			"serverFlag": 0,
			"sim": "",
			"userDue": "",
			"userId": 0
		}
	],
	"msg": ""
}

## show_device_by_id

View Device by ID
​

Endpoint /dpms/device/{deviceId}

Request Method GET

consumes ``

produces ["*/*"]

Description View device by ID

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
deviceId	deviceId	path	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«DeviceBaseInfoVO»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	DeviceBaseInfoVO	DeviceBaseInfoVO
msg	Return message	string	

Schema Property Description

DeviceBaseInfoVO

Parameter Name	Description	Type	Schema
activeTime	Activation time	string(date-time)	
avatar	Vehicle image	string	
canLogin	Whether can login separately	boolean	
carVin	Vehicle VIN number	string	
cardTypeId	Card type (CARD_TYPE_IMPORT_YEAR. One-year import card, CARD_TYPE_CONTINUE_YEAR: One-year renewal card, CARD_TYPE_ALL: Lifetime card, CARD_TYPE_TRY: Trial card)	string	
deviceName	Device name	string	
deviceType	Device type	string	
deviceVideoSetting	Camera settings	DeviceVideoSetting	DeviceVideoSetting
doorSetting	Door settings	DeviceDoorSetting	DeviceDoorSetting
driveCardNo	Driver ID card number	string	
driverName	Driver name	string	
extendInfo	Extended information	DeviceExtendInfo	DeviceExtendInfo
fuelValue	Fuel consumption	number(float)	
iccid	ICCID number	string	
icon	Device icon (1. Marker 2. Person 3. Pet 4. Cat 5. Dog)	integer(int32)	
iconName	Device icon English name	string	
id	Primary Key , Aliases 'vid' and 'deviceId' are used in other interfaces.	integer(int64)	
imei	Device IMEI number	string	
importTime	Import time	string(date-time)	
lastOnlineTime	Last online time	string(date-time)	
mobile	Contact mobile number	string	
obdSupportFlag	Whether supports OBD	boolean	
org	Belonging customer	OrgVO	OrgVO
overSpeed	Overspeed threshold	number(float)	
plateNo	License plate number	string	
platformDue	Platform expiration time	string(date-time)	
saleTime	Sales date	string(date-time)	
serverFlag	1: Lifetime 0: Non-lifetime	integer(int32)	
sim	SIM card number	string	
tireSetting	Tire pressure information	DeviceTireSetting	DeviceTireSetting
userDue	User expiration time	string(date-time)	
userId	User ID	integer(int64)	

DeviceVideoSetting

Parameter Name	Description	Type	Schema
videoInfos		array	VideoInfo

VideoInfo

Parameter Name	Description	Type	Schema
id		integer(int32)	
name		string	

DeviceDoorSetting

Parameter Name	Description	Type	Schema
doors		array	DeviceDoorInfo

DeviceDoorInfo

Parameter Name	Description	Type	Schema
flag	Door flag (Available values: LF,LB,RF,RB,BD)	string	
id	Bluetooth ID	string	

DeviceExtendInfo

Parameter Name	Description	Type	Schema
obdProtocolType	Available values: CAN_11_500,CAN_11_250,CAN_29_500_EX,CAN_11_29_250_EX,KWP2000,KWP2000M,ISO9141,VPW,PWM,PRIVATE,J1939,OTHER	string	

OrgVO

Parameter Name	Description	Type	Schema
avatar	Avatar	string	
contactAddress	Contact address	string	
contacts	Contact person	string	
createTime	Creation time	string(date-time)	
deviceQuantity1	Device quantity 1 (excluding sub-customers)	integer(int32)	
deviceQuantity2	Device quantity 2 (including sub-customers)	integer(int32)	
fullParent	Parent ID	array	
id	Organization ID	integer(int64)	
mobilePhone	Contact mobile	string	
orgCode	Organization code, also user account	string	
orgEmail	Email	string	
orgName	Customer name	string	
orgType	Type. Dealer: DEALER, General: GENERAL, Virtual organization: VIRTUAL, Monitor: MONITOR	string	
parentOrg	Parent organization	OrgVO	OrgVO
remark	Remarks	string	
telephone	Contact telephone	string	
timeZoneId	Time zone ID	integer(int64)	
userId	User ID	integer(int64)	
website	Website	string	

DeviceTireSetting

Parameter Name	Description	Type	Schema
tireNum	Tire quantity	integer(int32)	
tires		array	DeviceTireInfo

DeviceTireInfo

Parameter Name	Description	Type	Schema
id	Bluetooth ID	string	
name	Custom name	string	
tireId	Tire ID	integer(int32)	

Response Example

json
{
	"code": 0,
	"data": {
		"activeTime": "",
		"avatar": "",
		"canLogin": true,
		"carVin": "",
		"cardTypeId": "",
		"deviceName": "",
		"deviceType": "",
		"deviceVideoSetting": {
			"videoInfos": [
				{
					"id": 0,
					"name": ""
				}
			]
		},
		"doorSetting": {
			"doors": [
				{
					"flag": "",
					"id": ""
				}
			]
		},
		"driveCardNo": "",
		"driverName": "",
		"extendInfo": {
			"obdProtocolType": ""
		},
		"fuelValue": 0,
		"iccid": "",
		"icon": 0,
		"iconName": "",
		"id": 0,
		"imei": "",
		"importTime": "",
		"lastOnlineTime": "",
		"mobile": "",
		"obdSupportFlag": true,
		"org": {
			"avatar": "",
			"contactAddress": "",
			"contacts": "",
			"createTime": "",
			"deviceQuantity1": 0,
			"deviceQuantity2": 0,
			"fullParent": [],
			"id": 0,
			"mobilePhone": "",
			"orgCode": "",
			"orgEmail": "",
			"orgName": "",
			"orgType": "",
			"parentOrg": {
				"avatar": "",
				"contactAddress": "",
				"contacts": "",
				"createTime": "",
				"deviceQuantity1": 0,
				"deviceQuantity2": 0,
				"fullParent": [],
				"id": 0,
				"mobilePhone": "",
				"orgCode": "",
				"orgEmail": "",
				"orgName": "",
				"orgType": "",
				"parentOrg": {},
				"remark": "",
				"telephone": "",
				"timeZoneId": 0,
				"userId": 0,
				"website": ""
			},
			"remark": "",
			"telephone": "",
			"timeZoneId": 0,
			"userId": 0,
			"website": ""
		},
		"overSpeed": 0,
		"plateNo": "",
		"platformDue": "",
		"saleTime": "",
		"serverFlag": 0,
		"sim": "",
		"tireSetting": {
			"tireNum": 0,
			"tires": [
				{
					"id": "",
					"name": "",
					"tireId": 0
				}
			]
		},
		"userDue": "",
		"userId": 0
	},
	"msg": ""
}

## show_device_by_imei

View Device by IMEI
​

Endpoint /dpms/device/show

Request Method GET

consumes ``

produces ["*/*"]

Description View device by IMEI

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
imei	imei	query	true	string	

Response Status

Status Code	Description	Schema
200	OK	R«DeviceBaseInfoVO»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	DeviceBaseInfoVO	DeviceBaseInfoVO
msg	Return message	string	

Schema Property Description

DeviceBaseInfoVO

Parameter Name	Description	Type	Schema
activeTime	Activation time	string(date-time)	
avatar	Vehicle image	string	
canLogin	Whether can login separately	boolean	
carVin	Vehicle VIN number	string	
cardTypeId	Card type (CARD_TYPE_IMPORT_YEAR. One-year import card, CARD_TYPE_CONTINUE_YEAR: One-year renewal card, CARD_TYPE_ALL: Lifetime card, CARD_TYPE_TRY: Trial card)	string	
deviceName	Device name	string	
deviceType	Device type	string	
deviceVideoSetting	Camera settings	DeviceVideoSetting	DeviceVideoSetting
doorSetting	Door settings	DeviceDoorSetting	DeviceDoorSetting
driveCardNo	Driver ID card number	string	
driverName	Driver name	string	
extendInfo	Extended information	DeviceExtendInfo	DeviceExtendInfo
fuelValue	Fuel consumption	number(float)	
iccid	ICCID number	string	
icon	Device icon (1. Marker 2. Person 3. Pet 4. Cat 5. Dog)	integer(int32)	
iconName	Device icon English name	string	
id	Primary Key , Aliases 'vid' and 'deviceId' are used in other interfaces.	integer(int64)	
imei	Device IMEI number	string	
importTime	Import time	string(date-time)	
lastOnlineTime	Last online time	string(date-time)	
mobile	Contact mobile number	string	
obdSupportFlag	Whether supports OBD	boolean	
org	Belonging customer	OrgVO	OrgVO
overSpeed	Overspeed threshold	number(float)	
plateNo	License plate number	string	
platformDue	Platform expiration time	string(date-time)	
saleTime	Sales date	string(date-time)	
serverFlag	1: Lifetime 0: Non-lifetime	integer(int32)	
sim	SIM card number	string	
tireSetting	Tire pressure information	DeviceTireSetting	DeviceTireSetting
userDue	User expiration time	string(date-time)	
userId	User ID	integer(int64)	

DeviceVideoSetting

Parameter Name	Description	Type	Schema
videoInfos		array	VideoInfo

VideoInfo

Parameter Name	Description	Type	Schema
id		integer(int32)	
name		string	

DeviceDoorSetting

Parameter Name	Description	Type	Schema
doors		array	DeviceDoorInfo

DeviceDoorInfo

Parameter Name	Description	Type	Schema
flag	Door flag (Available values: LF,LB,RF,RB,BD)	string	
id	Bluetooth ID	string	

DeviceExtendInfo

Parameter Name	Description	Type	Schema
obdProtocolType	Available values: CAN_11_500,CAN_11_250,CAN_29_500_EX,CAN_11_29_250_EX,KWP2000,KWP2000M,ISO9141,VPW,PWM,PRIVATE,J1939,OTHER	string	

OrgVO

Parameter Name	Description	Type	Schema
avatar	Avatar	string	
contactAddress	Contact address	string	
contacts	Contact person	string	
createTime	Creation time	string(date-time)	
deviceQuantity1	Device quantity 1 (excluding sub-customers)	integer(int32)	
deviceQuantity2	Device quantity 2 (including sub-customers)	integer(int32)	
fullParent	Parent ID	array	
id	Organization ID	integer(int64)	
mobilePhone	Contact mobile	string	
orgCode	Organization code, also user account	string	
orgEmail	Email	string	
orgName	Customer name	string	
orgType	Type. Dealer: DEALER, General: GENERAL, Virtual organization: VIRTUAL, Monitor: MONITOR	string	
parentOrg	Parent organization	OrgVO	OrgVO
remark	Remarks	string	
telephone	Contact telephone	string	
timeZoneId	Time zone ID	integer(int64)	
userId	User ID	integer(int64)	
website	Website	string	

DeviceTireSetting

Parameter Name	Description	Type	Schema
tireNum	Tire quantity	integer(int32)	
tires		array	DeviceTireInfo

DeviceTireInfo

Parameter Name	Description	Type	Schema
id	Bluetooth ID	string	
name	Custom name	string	
tireId	Tire ID	integer(int32)	

Response Example

json
{
	"code": 0,
	"data": {
		"activeTime": "",
		"avatar": "",
		"canLogin": true,
		"carVin": "",
		"cardTypeId": "",
		"deviceName": "",
		"deviceType": "",
		"deviceVideoSetting": {
			"videoInfos": [
				{
					"id": 0,
					"name": ""
				}
			]
		},
		"doorSetting": {
			"doors": [
				{
					"flag": "",
					"id": ""
				}
			]
		},
		"driveCardNo": "",
		"driverName": "",
		"extendInfo": {
			"obdProtocolType": ""
		},
		"fuelValue": 0,
		"iccid": "",
		"icon": 0,
		"iconName": "",
		"id": 0,
		"imei": "",
		"importTime": "",
		"lastOnlineTime": "",
		"mobile": "",
		"obdSupportFlag": true,
		"org": {
			"avatar": "",
			"contactAddress": "",
			"contacts": "",
			"createTime": "",
			"deviceQuantity1": 0,
			"deviceQuantity2": 0,
			"fullParent": [],
			"id": 0,
			"mobilePhone": "",
			"orgCode": "",
			"orgEmail": "",
			"orgName": "",
			"orgType": "",
			"parentOrg": {
				"avatar": "",
				"contactAddress": "",
				"contacts": "",
				"createTime": "",
				"deviceQuantity1": 0,
				"deviceQuantity2": 0,
				"fullParent": [],
				"id": 0,
				"mobilePhone": "",
				"orgCode": "",
				"orgEmail": "",
				"orgName": "",
				"orgType": "",
				"parentOrg": {},
				"remark": "",
				"telephone": "",
				"timeZoneId": 0,
				"userId": 0,
				"website": ""
			},
			"remark": "",
			"telephone": "",
			"timeZoneId": 0,
			"userId": 0,
			"website": ""
		},
		"overSpeed": 0,
		"plateNo": "",
		"platformDue": "",
		"saleTime": "",
		"serverFlag": 0,
		"sim": "",
		"tireSetting": {
			"tireNum": 0,
			"tires": [
				{
					"id": "",
					"name": "",
					"tireId": 0
				}
			]
		},
		"userDue": "",
		"userId": 0
	},
	"msg": ""
}

## tracker_device

Track Device
​

Endpoint /tapi/tracker

Request Method POST

consumes ["application/json"]

produces ["*/*"]

Description Track device, first track devices according to orgId (excluding devices of sub-organizations); if orgId is null, track devices according to imeiList

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
body	body	body	true	TrackerDeviceDto	TrackerDeviceDto

Schema Property Description

TrackerDeviceDto

Parameter Name	Description	Request Type	Required	Data Type	Schema
historyFlag	Whether to include recent 10 historical data records for track correction	body	false	boolean	
imeiList	Device IMEI list	body	false	array	
lastQueryTime	Last query time, should be null for first query	body	false	string(date-time)	
orgId	Organization ID, if empty use imeiList instead	body	false	integer(int64)	

Response Status

Status Code	Description	Schema
200	OK	R«TrackerGpsInfoVo»
201	Created	
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	TrackerGpsInfoVo	TrackerGpsInfoVo
msg	Return message	string	

Schema Property Description

TrackerGpsInfoVo

Parameter Name	Description	Type	Schema
gpsInfos	Latest GPS data	array	GpsTrackVo
gpsWarns	Latest WARN data	array	GpsWarnDataVO
lastQueryTime	Current query time, need to include this data in next query	string(date-time)	
zeroGpsInfo	User zero-point GPS data	array	GpsTrackVo

GpsTrackVo

Parameter Name	Description	Type	Schema
adVoltages	AD voltage values, ID is sequence number, VALUE is value: unit 0.01V	array	IdValueDto
alcoholSensors	Alcohol sensor data	array	AlcoholSensorDto
altitude	Altitude 0.1m	integer(int32)	
angle	Moving direction angle	number(double)	
batVoltage	Internal battery voltage value unit: 0.01V	integer(int32)	
csqQuantity	GSM signal value	integer(int32)	
deviceName	Device name	string	
doorSensors	Door sensor data	array	DoorSensorDto
extVoltage	External power voltage value unit: 0.01V	integer(int32)	
fuelLiters	Fuel quantity, ID is sequence number, VALUE is value: unit 0.1L	array	IdValueDto
gpsTime	GPS time	string(date-time)	
hdop	Horizontal dilution of precision	number(double)	
heartRateSensors	Heart rate sensor data	array	HeartRateSensorDto
imei	IMEI number	string	
lastOnlineTime	Last online time	string(date-time)	
lastStayTime	Last stay time	string(date-time)	
lat	Latitude	number	
lon	Longitude	number	
mask1	Mask 1	integer(int32)	
mask2	Mask 2	integer(int32)	
mask3	Mask 3	integer(int32)	
mask4	Mask 4	integer(int32)	
mask5	Mask 5	integer(int32)	
mask6	Mask 6	integer(int32)	
mask7	Mask 7	integer(int32)	
mask8	Mask 8	integer(int32)	
obdData	OBD data	ObdDataDto	ObdDataDto
obdFault	OBD fault	ObdFaultDto	ObdFaultDto
odometer	Accumulated total mileage, unit meter	integer(int32)	
photo	Photo data	PhotoDto	PhotoDto
preTracks	Recent tracking trajectory	array	GpsTrackVo
quantity	Number of satellite signals received	integer(int32)	
speed	Speed m/hour	integer(int32)	
speedSensors	Speed sensor data	array	SpeedSensorDto
status1	Status 1	integer(int32)	
status2	Status 2	integer(int32)	
status3	Status 3	integer(int32)	
status4	Status 4	integer(int32)	
status5	Status 5	integer(int32)	
status6	Status 6	integer(int32)	
status7	Status 7	integer(int32)	
status8	Status 8	integer(int32)	
swipeInfo	Clock-in information	GpsSwipeInfoVo	GpsSwipeInfoVo
tempSensors	Sensor temperature, ID is sequence number, VALUE is value: unit 0.1°C	array	TemperatureDto
tirePressureSensors	Tire pressure sensor data	array	TirePressureSensorDto
validity	Whether valid	boolean	
vid	Device ID	integer(int64)	
warnFlag1	Alarm word 1	integer(int32)	
warnFlag2	Alarm word 2	integer(int32)	
warnMask1	Alarm word mask 1	integer(int32)	
warnMask2	Alarm word mask 2	integer(int32)	
watchInfo	Watch related information	WatchInfo	WatchInfo

IdValueDto

Parameter Name	Description	Type	Schema
attribute	Other attributes	object	
id	Sequence number	string	
value	Value	integer(int32)	

AlcoholSensorDto

Parameter Name	Description	Type	Schema
alcoholConcentration	Alcohol concentration	integer(int32)	
id	Index	string	
useTime	Use time	integer(int32)	

DoorSensorDto

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	integer(int32)	
flag	Door flag (Available values: LF,LB,RF,RB,BD)	string	
id	Bluetooth index	string	
status	Status 1: Open 0: Close	integer(int32)	

HeartRateSensorDto

Parameter Name	Description	Type	Schema
heartRate	Heart rate	integer(int32)	
id	Index	string	
respiratoryRate	Respiratory rate	integer(int32)	

ObdDataDto

Parameter Name	Description	Type	Schema
ambientTemp	Ambient temperature ℃	number(double)	
aps	Accelerator pedal position %	number(double)	
atmoPress	Atmospheric pressure kPa	integer(int32)	
coolantTemp	Coolant temperature Engine coolant temperature. Unit: ℃	number(double)	
defaultNum	Fault code count	integer(int32)	
defaultOdometer	Fault mileage Km	integer(int32)	
defaultStatus	Fault code status "0" means not lit, "1" means lit	integer(int32)	
engineLoad	Engine load percentage. Unit: %	number(double)	
fuelLevel	Fuel level 35L means remaining 35L fuel	string	
fuelPressure	Fuel pressure kPa %	integer(int32)	
gpsTime	GPS time	string(date-time)	
iaa	First cylinder ignition timing advance angle %	number(double)	
instantFuel	Instantaneous fuel consumption Unit: L/h	number(double)	
intakePressure	Intake pressure Unit: kPa	number(double)	
intakeTemp	Intake temperature Unit: ℃	number(double)	
ltf	Long term fuel trim (Bank 1 and 3) %	number(double)	
mafFlow	Mass air flow Unit: g/s	number(double)	
rpm	Engine speed RPM Unit: r/min	integer(int32)	
speed	Vehicle speed Km/h	integer(int32)	
startSec	Time since engine start sec	integer(int32)	
throttle	Throttle position Unit: %	number(double)	

ObdFaultDto

Parameter Name	Description	Type	Schema
code	Code	string	
gpsTime	GPS time	string(date-time)	
lat	Latitude	number(double)	
lon	Longitude	number(double)	
status	Status	integer(int32)	
type	Type	string	
vid	Device ID	integer(int64)	

PhotoDto

Parameter Name	Description	Type	Schema
cid	Channel ID	integer(int32)	
name	Image name	string	
photoTime	GPS time	string(date-time)	
vid	Device ID	integer(int64)	

SpeedSensorDto

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	integer(int32)	
id	Index	string	
odometer	Mileage meter	integer(int32)	
rpm	RPM, unit 0.1rpm	integer(int32)	
speed	Speed m/hour	integer(int32)	
turnFlag	true-forward, 1-reverse	boolean	

GpsSwipeInfoVo

Parameter Name	Description	Type	Schema
cardName	ID name	string	
cardNo	Card number	string	
gpsTime	GPS time	string(date-time)	
lat	Longitude	number	
lon	Latitude	number	

TemperatureDto

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	integer(int32)	
humidity	Humidity, percentage	integer(int32)	
id	Index	string	
temperature	Temperature, unit 0.1 degree	integer(int32)	

TirePressureSensorDto

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	integer(int32)	
id	Index	string	
pressure	Pressure: 0.1Kpa	integer(int32)	
status	Status 00 - Normal, 01 - Leakage, 02 - Inflating, 03 - Starting (tire rotating), 04 - Power on (sensor first power on)	integer(int32)	
temperature	Temperature: 0.1 degree	integer(int32)	
tireInfoId	Tire pressure ID	integer(int32)	

WatchInfo

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	string	
rolling	Rollover count	string	
step	Step count	string	

GpsWarnDataVO

Parameter Name	Description	Type	Schema
altitude	Altitude 0.1m	number(double)	
deviceName	Device name	string	
gpsTime	GPS time	string(date-time)	
id		string	
imei	IMEI number	string	
lat	Latitude	number	
lon	Longitude	number	
sourceType	Source platform or terminal 0-terminal 1-platform	integer(int32)	
speed	Speed m/second	integer(int32)	
vid		integer(int64)	
warnId	Alarm ID	integer(int32)	
warnInfo	Alarm information	string	

Response Example

json
{
	"code": 0,
	"data": {
		"gpsInfos": [
			{
				"adVoltages": [
					{
						"attribute": {},
						"id": "",
						"value": 0
					}
				],
				"alcoholSensors": [
					{
						"alcoholConcentration": 0,
						"id": "",
						"useTime": 0
					}
				],
				"altitude": 0,
				"angle": 0,
				"batVoltage": 0,
				"csqQuantity": 0,
				"deviceName": "",
				"doorSensors": [
					{
						"eleQuantity": 0,
						"flag": "",
						"id": "",
						"status": 0
					}
				],
				"extVoltage": 0,
				"fuelLiters": [
					{
						"attribute": {},
						"id": "",
						"value": 0
					}
				],
				"gpsTime": "",
				"hdop": 0,
				"heartRateSensors": [
					{
						"heartRate": 0,
						"id": "",
						"respiratoryRate": 0
					}
				],
				"imei": "",
				"lastOnlineTime": "",
				"lastStayTime": "",
				"lat": 0,
				"lon": 0,
				"mask1": 0,
				"mask2": 0,
				"mask3": 0,
				"mask4": 0,
				"mask5": 0,
				"mask6": 0,
				"mask7": 0,
				"mask8": 0,
				"obdData": {
					"ambientTemp": 0,
					"aps": 0,
					"atmoPress": 0,
					"coolantTemp": 0,
					"defaultNum": 0,
					"defaultOdometer": 0,
					"defaultStatus": 0,
					"engineLoad": 0,
					"fuelLevel": "",
					"fuelPressure": 0,
					"gpsTime": "",
					"iaa": 0,
					"instantFuel": 0,
					"intakePressure": 0,
					"intakeTemp": 0,
					"ltf": 0,
					"mafFlow": 0,
					"rpm": 0,
					"speed": 0,
					"startSec": 0,
					"throttle": 0
				},
				"obdFault": {
					"code": "",
					"gpsTime": "",
					"lat": 0,
					"lon": 0,
					"status": 0,
					"type": "",
					"vid": 0
				},
				"odometer": 0,
				"photo": {
					"cid": 0,
					"name": "",
					"photoTime": "",
					"vid": 0
				},
				"preTracks": [
					{}
				],
				"quantity": 0,
				"speed": 0,
				"speedSensors": [
					{
						"eleQuantity": 0,
						"id": "",
						"odometer": 0,
						"rpm": 0,
						"speed": 0,
						"turnFlag": true
					}
				],
				"status1": 0,
				"status2": 0,
				"status3": 0,
				"status4": 0,
				"status5": 0,
				"status6": 0,
				"status7": 0,
				"status8": 0,
				"swipeInfo": {
					"cardName": "",
					"cardNo": "",
					"gpsTime": "",
					"lat": 0,
					"lon": 0
				},
				"tempSensors": [
					{
						"eleQuantity": 0,
						"humidity": 0,
						"id": "",
						"temperature": 0
					}
				],
				"tirePressureSensors": [
					{
						"eleQuantity": 0,
						"id": "",
						"pressure": 0,
						"status": 0,
						"temperature": 0,
						"tireInfoId": 0
					}
				],
				"validity": true,
				"vid": 0,
				"warnFlag1": 0,
				"warnFlag2": 0,
				"warnMask1": 0,
				"warnMask2": 0,
				"watchInfo": {
					"eleQuantity": "",
					"rolling": "",
					"step": ""
				}
			}
		],
		"gpsWarns": [
			{
				"altitude": 0,
				"deviceName": "",
				"gpsTime": "",
				"id": "",
				"imei": "",
				"lat": 0,
				"lon": 0,
				"sourceType": 0,
				"speed": 0,
				"vid": 0,
				"warnId": 0,
				"warnInfo": ""
			}
		],
		"lastQueryTime": "",
		"zeroGpsInfo": [
			{}
		]
	},
	"msg": ""
}

## history_device

History Tracking
​

Endpoint /tapi/tracker/history/{imei}

Request Method GET

consumes ``

produces ["*/*"]

Description Single device track query

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	false	string	
filterDrift	Whether to filter drift	query	false	boolean	
imei	imei	path	true	string	
startTime	Start time	query	false	string	

Response Status

Status Code	Description	Schema
200	OK	R«List«GpsHistoryTrackSimpleVo»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GpsHistoryTrackSimpleVo
msg	Return message	string	

Schema Property Description

GpsHistoryTrackSimpleVo

Parameter Name	Description	Type	Schema
adVoltages	AD voltage values, ID is sequence number, VALUE is value: unit 0.1V	array	IdValueDto
angle	Moving direction angle	number(double)	
batVoltage	Internal battery voltage value unit: 0.1V	integer(int32)	
csqQuantity	GSM signal value	integer(int32)	
extVoltage	External power voltage value unit: 0.1V	integer(int32)	
fuelLiters	Fuel quantity, ID is sequence number, VALUE is value: unit 0.1L	array	IdValueDto
gpsTime	GPS time	string(date-time)	
lat	Latitude	number	
lon	Longitude	number	
mask1	Mask 1	integer(int32)	
odometer	Accumulated total mileage	integer(int32)	
quantity	Number of satellite signals received	integer(int32)	
recTime		string(date-time)	
rfid		string	
speed	Speed m/hour	integer(int32)	
status1	Status 1	integer(int32)	
tempSensors	Sensor temperature, ID is sequence number, VALUE is value: unit 0.1°C	array	TemperatureDto
warnIds		array	
watchInfo		WatchInfo	WatchInfo

IdValueDto

Parameter Name	Description	Type	Schema
attribute	Other attributes	object	
id	Sequence number	string	
value	Value	integer(int32)	

TemperatureDto

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	integer(int32)	
humidity	Humidity, percentage	integer(int32)	
id	Index	string	
temperature	Temperature, unit 0.1 degree	integer(int32)	

WatchInfo

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	string	
rolling	Rollover count	string	
step	Step count	string	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"adVoltages": [
				{
					"attribute": {},
					"id": "",
					"value": 0
				}
			],
			"angle": 0,
			"batVoltage": 0,
			"csqQuantity": 0,
			"extVoltage": 0,
			"fuelLiters": [
				{
					"attribute": {},
					"id": "",
					"value": 0
				}
			],
			"gpsTime": "",
			"lat": 0,
			"lon": 0,
			"mask1": 0,
			"odometer": 0,
			"quantity": 0,
			"recTime": "",
			"rfid": "",
			"speed": 0,
			"status1": 0,
			"tempSensors": [
				{
					"eleQuantity": 0,
					"humidity": 0,
					"id": "",
					"temperature": 0
				}
			],
			"warnIds": [],
			"watchInfo": {
				"eleQuantity": "",
				"rolling": "",
				"step": ""
			}
		}
	],
	"msg": ""
}

## term_ctrl

Terminal Control
​

Interface URL /tapi/command/{termId}/termCtrl

Request Method POST

consumes ["application/json"]

produces ["*/*"]

Interface Description Terminal Control

Request Parameters
​
Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg "bearer mWBURPjUOi_13oU3TDgm-ZC6EwU"	header	true	string	
termCtrlSndDto	termCtrlSndDto	body	true	TermCtrlSndDto	TermCtrlSndDto
termId	IMEI number	path	true	string	
Schema Attribute Description
​
TermCtrlSndDto
​
Parameter Name	Description	Request Type	Required	Data Type	Schema
ctrlType	OIL_ELE_CUT: fuel/electricity cut OIL_ELE_RECOVER: restore fuel/electricity	body	false	string	
Response Status
​
Status Code	Description	Schema
200	OK	R«TermResultCo»
201	Created	
401	Unauthorized	
403	Forbidden	
404	Not Found	
Response Parameters
​
Parameter Name	Description	Type	Schema
code	Return flag: success flag=0, failure flag=1	integer(int32)	integer(int32)
data	Data	TermResultCo	TermResultCo
msg	Return message	string	
Schema Attribute Description
​
TermResultCo
​
Parameter Name	Description	Type	Schema
data		object	
requestId	request message id.Based on it, you can get the terminal's return result.	string	
result	Available values: SUCCESS, OFF_LINE, FAIL	string	
Response Example
​
json
{
    "code": 0,
    "data": {
        "data": {},
        "requestId": "",
        "result": ""
    },
    "msg": ""
}

## term_command_result

Query Sending Command Result
​

Interface URL /tapi/command/{termId}/trackerSndResult

Request Method GET

consumes ``

produces ["*/*"]

Interface Description Query sending command result

Request Parameters
​
Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg "bearer mWBURPjUOi_13oU3TDgm-ZC6EwU"	header	true	string	
requestId	request message id	query	true	string	
termId	IMEI number	path	true	string	
Response Status
​
Status Code	Description	Schema
200	OK	R«CommandHistory»
401	Unauthorized	
403	Forbidden	
404	Not Found	
Response Parameters
​
Parameter Name	Description	Type	Schema
code	Return flag: success flag=0, failure flag=1	integer(int32)	integer(int32)
data	Data	CommandHistory	CommandHistory
msg	Return message	string	
Schema Attribute Description
​
CommandHistory
​
Parameter Name	Description	Type	Schema
cmd	Command type	string	
createTime	Creation time	string(date-time)	
createUser	Created by user	string	
explainData	Explained data	string	
extData	Extended data	string	
id	ID	string	
imei	IMEI number	string	
msgId	Message ID	string	
orgId	Organization ID	integer(int64)	
postData	Push data	string	
protocol	Protocol type	string	
requestData	Request data	string	
responseData	Response data	string	
seq	Sequence number	integer(int32)	
updateTime	Modification time	string(date-time)	
Response Example
​
json
{
    "code": 0,
    "data": {
        "cmd": "",
        "createTime": "",
        "createUser": "",
        "explainData": "",
        "extData": "",
        "id": "",
        "imei": "",
        "msgId": "",
        "orgId": 0,
        "postData": "",
        "protocol": "",
        "requestData": "",
        "responseData": "",
        "seq": 0
    },
    "msg": ""
}

## report_working

Ops Overview
​

Endpoint /tapi/report/working

Request Method GET

consumes ``

produces ["*/*"]

Description Operations overview

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
orgId	Organization ID	query	true	integer	
startTime	Start time	query	true	string	
zeroFilter	Filter zero data, true, others no filter	query	false	boolean	

Response Status

Status Code	Description	Schema
200	OK	R«GpsWorkingOverviewVo»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsWorkingOverviewVo	GpsWorkingOverviewVo
msg	Return message	string	

Schema Property Description

GpsWorkingOverviewVo

Parameter Name	Description	Type	Schema
deviceNum	Total number of devices	integer(int32)	
odometer	Total mileage: unit meter	integer(int32)	
overSpeedNum	Total overspeed count	integer(int32)	
stopNum	Total stop count	integer(int32)	
workingDeviceInfos	Device operation details list	array	GpsWorkingDeviceVo

GpsWorkingDeviceVo

Parameter Name	Description	Type	Schema
deviceName	Device name	string	
imei	IMEI number	string	
odometer	Mileage: unit meter	integer(int32)	
overSpeedNum	Overspeed count	integer(int32)	
stopNum	Stop count	integer(int32)	
vid	Device ID	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": {
		"deviceNum": 0,
		"odometer": 0,
		"overSpeedNum": 0,
		"stopNum": 0,
		"workingDeviceInfos": [
			{
				"deviceName": "",
				"odometer": 0,
				"overSpeedNum": 0,
				"stopNum": 0,
				"vid": 0
			}
		]
	},
	"msg": ""
}

## report_history

History Report
​

Endpoint /tapi/report/history

Request Method GET

consumes ``

produces ["*/*"]

Description Device history track query

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«List«GpsHistoryTrackVo»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GpsHistoryTrackVo
msg	Return message	string	

Schema Property Description

GpsHistoryTrackVo

Parameter Name	Description	Type	Schema
adVoltages	AD voltage values, ID is sequence number, VALUE is value: unit 0.1V	array	IdValueDto
altitude	Altitude 0.1m	integer(int32)	
angle	Moving direction angle	number(double)	
batVoltage	Internal battery voltage value unit: 0.1V	integer(int32)	
csqQuantity	GSM signal value	integer(int32)	
deviceName	Device name	string	
extVoltage	External power voltage value unit: 0.1V	integer(int32)	
fuelLiters	Fuel quantity, ID is sequence number, VALUE is value: unit 0.1L	array	IdValueDto
gpsTime	GPS time	string(date-time)	
hdop	Horizontal dilution of precision	number(double)	
imei	IMEI number	string	
lat	Latitude	number	
lon	Longitude	number	
mask1	Mask 1	integer(int32)	
mask2	Mask 2	integer(int32)	
mask3	Mask 3	integer(int32)	
mask4	Mask 4	integer(int32)	
mask5	Mask 5	integer(int32)	
mask6	Mask 6	integer(int32)	
mask7	Mask 7	integer(int32)	
mask8	Mask 8	integer(int32)	
odometer	Accumulated total mileage	integer(int32)	
quantity	Number of satellite signals received	integer(int32)	
recTime	Receive time	string(date-time)	
rfid	RFID	string	
speed	Speed m/hour	integer(int32)	
status1	Status 1	integer(int32)	
status2	Status 2	integer(int32)	
status3	Status 3	integer(int32)	
status4	Status 4	integer(int32)	
status5	Status 5	integer(int32)	
status6	Status 6	integer(int32)	
status7	Status 7	integer(int32)	
status8	Status 8	integer(int32)	
tempSensors	Sensor temperature, ID is sequence number, VALUE is value: unit 0.1°C	array	TemperatureDto
validity	Whether valid	boolean	
vid	Device ID	integer(int64)	
warnFlag1	Alarm word 1	integer(int32)	
warnFlag2	Alarm word 2	integer(int32)	
warnIds	Corresponding alarm IDs	array	
warnMask1	Alarm word mask 1	integer(int32)	
warnMask2	Alarm word mask 2	integer(int32)	
watchInfo	Watch related information	WatchInfo	WatchInfo

IdValueDto

Parameter Name	Description	Type	Schema
attribute	Other attributes	object	
id	Sequence number	string	
value	Value	integer(int32)	

TemperatureDto

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	integer(int32)	
humidity	Humidity, percentage	integer(int32)	
id	Index	string	
temperature	Temperature, unit 0.1 degree	integer(int32)	

WatchInfo

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	string	
rolling	Rollover count	string	
step	Step count	string	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"adVoltages": [
				{
					"attribute": {},
					"id": "",
					"value": 0
				}
			],
			"altitude": 0,
			"angle": 0,
			"batVoltage": 0,
			"csqQuantity": 0,
			"deviceName": "",
			"extVoltage": 0,
			"fuelLiters": [
				{
					"attribute": {},
					"id": "",
					"value": 0
				}
			],
			"gpsTime": "",
			"hdop": 0,
			"imei": "",
			"lat": 0,
			"lon": 0,
			"mask1": 0,
			"mask2": 0,
			"mask3": 0,
			"mask4": 0,
			"mask5": 0,
			"mask6": 0,
			"mask7": 0,
			"mask8": 0,
			"odometer": 0,
			"quantity": 0,
			"recTime": "",
			"rfid": "",
			"speed": 0,
			"status1": 0,
			"status2": 0,
			"status3": 0,
			"status4": 0,
			"status5": 0,
			"status6": 0,
			"status7": 0,
			"status8": 0,
			"tempSensors": [
				{
					"eleQuantity": 0,
					"humidity": 0,
					"id": "",
					"temperature": 0
				}
			],
			"validity": true,
			"vid": 0,
			"warnFlag1": 0,
			"warnFlag2": 0,
			"warnIds": [],
			"warnMask1": 0,
			"warnMask2": 0,
			"watchInfo": {
				"eleQuantity": "",
				"rolling": "",
				"step": ""
			}
		}
	],
	"msg": ""
}

## report_day_running

Mileage Stats
​

Endpoint /tapi/report/day_running

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«List«GpsDayRunningReportVo»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GpsDayRunningReportVo
msg	Return message	string	

Schema Property Description

GpsDayRunningReportVo

Parameter Name	Description	Type	Schema
details		array	GpsDayRunningVO
deviceName	Device name	string	
id	id	integer(int64)	
imei	imei	string	
odometer	Total mileage: unit meter	integer(int32)	
overSpeedNum	Total overspeed count	integer(int32)	
stopNum	Total stop count	integer(int32)	

GpsDayRunningVO

Parameter Name	Description	Type	Schema
day	Statistics day	string	
deviceName	Device name	string	
fuel	Total amount	integer(int32)	
imei	imei	string	
odometer	Mileage: unit meter	integer(int32)	
overSpeedNum	Overspeed count	integer(int32)	
stopNum	Stop count	integer(int32)	
vid	Device ID	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"details": [
				{
					"day": "",
					"deviceName": "",
					"fuel": 0,
					"odometer": 0,
					"overSpeedNum": 0,
					"stopNum": 0,
					"vid": 0
				}
			],
			"deviceName": "",
			"id": 0,
			"imei": "",
			"odometer": 0,
			"overSpeedNum": 0,
			"stopNum": 0
		}
	],
	"msg": ""
}

## report_over_speed_detail

Overspeed Details
​

Endpoint /tapi/report/over_speed_detail

Request Method GET

consumes ``

produces ["*/*"]

Description Overspeed details

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«List«GpsOverSpeedStatVo»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GpsOverSpeedStatVo
msg	Return message	string	

Schema Property Description

GpsOverSpeedStatVo

Parameter Name	Description	Type	Schema
details	Details	array	GpsOverSpeedDetailVo
deviceName	Device name	string	
id	Device ID	integer(int64)	

GpsOverSpeedDetailVo

Parameter Name	Description	Type	Schema
deviceName	Device name	string	
duration	Total duration (seconds)	integer(int32)	
endGpsTime	End time	string(date-time)	
endLat	End longitude	number	
endLon	End latitude	number	
maxSpeed	Maximum speed m/hour	integer(int32)	
minSpeed	Minimum speed m/hour	integer(int32)	
odometer	Total driving mileage (meters)	integer(int32)	
speed	Speed m/hour	integer(int32)	
startGpsTime	Start time	string(date-time)	
startLat	Start longitude	number	
startLon	Start latitude	number	
vid	Device ID	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"details": [
				{
					"deviceName": "",
					"duration": 0,
					"endGpsTime": "",
					"endLat": 0,
					"endLon": 0,
					"maxSpeed": 0,
					"minSpeed": 0,
					"odometer": 0,
					"speed": 0,
					"startGpsTime": "",
					"startLat": 0,
					"startLon": 0,
					"vid": 0
				}
			],
			"deviceName": "",
			"id": 0
		}
	],
	"msg": ""
}

## report_trip_stop

Stop Details
​

Endpoint /tapi/report/trip_stop

Request Method GET

consumes ``

produces ["*/*"]

Description Stop details

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«List«GpsTripStopVo»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GpsTripStopVo
msg	Return message	string	

Schema Property Description

GpsTripStopVo

Parameter Name	Description	Type	Schema
duration	Total duration (seconds)	integer(int32)	
endGpsTime	Trip end time	string(date-time)	
lat	Longitude	number	
lon	Latitude	number	
startGpsTime	Trip start time	string(date-time)	
vid	Device ID	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"duration": 0,
			"endGpsTime": "",
			"lat": 0,
			"lon": 0,
			"startGpsTime": "",
			"vid": 0
		}
	],
	"msg": ""
}

## report_trip_report

Trip Stats
​

Endpoint /tapi/report/trip_report

Request Method GET

consumes ``

produces ["*/*"]

Description Trip statistics

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«GpsTripStatVo»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsTripStatVo	GpsTripStatVo
msg	Return message	string	

Schema Property Description

GpsTripStatVo

Parameter Name	Description	Type	Schema
duration	Total duration (seconds)	integer(int32)	
odometer	Total driving mileage (meters)	integer(int32)	
stopDuration	Total stop duration (seconds)	integer(int32)	
stopNum	Stop count	integer(int32)	
trips	Details	array	GpsTripVo

GpsTripVo

Parameter Name	Description	Type	Schema
accFlag	ACC status	boolean	
averageSpeed	Average speed m/hour	integer(int32)	
duration	Total duration (seconds)	integer(int32)	
endGpsTime	Trip end time	string(date-time)	
endLat	Trip end latitude	number(double)	
endLon	Trip end longitude	number(double)	
fuel	Fuel consumption 0.1L	integer(int32)	
gpsMile	GPS total mileage (meters)	integer(int32)	
maxSpeed	Maximum speed m/hour	integer(int32)	
odometer	Total driving mileage (meters)	integer(int32)	
runFlag	Driving flag	boolean	
startGpsTime	Trip start time	string(date-time)	
startLat	Trip start latitude	number(double)	
startLon	Trip start longitude	number(double)	
vid	vid	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": {
		"duration": 0,
		"odometer": 0,
		"stopDuration": 0,
		"stopNum": 0,
		"trips": [
			{
				"accFlag": true,
				"averageSpeed": 0,
				"duration": 0,
				"endGpsTime": "",
				"endLat": 0,
				"endLon": 0,
				"fuel": 0,
				"gpsMile": 0,
				"maxSpeed": 0,
				"odometer": 0,
				"runFlag": true,
				"startGpsTime": "",
				"startLat": 0,
				"startLon": 0,
				"vid": 0
			}
		]
	},
	"msg": ""
}

## report_over_speed_range_report

Overspeed Time Stats
​

Endpoint /tapi/report/over_speed_range_report

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«GpsOverSpeedRangeVo»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsOverSpeedRangeVo	GpsOverSpeedRangeVo
msg	Return message	string	

Schema Property Description

GpsOverSpeedRangeVo

Parameter Name	Description	Type	Schema
details		array	GpsOverSpeedDetailVo
duration	Total duration (seconds)	integer(int32)	
maxSpeed	Maximum speed m/hour	integer(int32)	
minSpeed	Minimum speed m/hour	integer(int32)	
odometer	Total driving mileage (meters)	integer(int32)	

GpsOverSpeedDetailVo

Parameter Name	Description	Type	Schema
deviceName	Device name	string	
duration	Total duration (seconds)	integer(int32)	
endGpsTime	End time	string(date-time)	
endLat	End latitude	number	
endLon	End longitude	number	
maxSpeed	Maximum speed m/hour	integer(int32)	
minSpeed	Minimum speed m/hour	integer(int32)	
odometer	Total driving mileage (meters)	integer(int32)	
speed	Speed m/hour	integer(int32)	
startGpsTime	Start time	string(date-time)	
startLat	Start latitude	number	
startLon	Start longitude	number	
vid	Device ID	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": {
		"details": [
			{
				"deviceName": "",
				"duration": 0,
				"endGpsTime": "",
				"endLat": 0,
				"endLon": 0,
				"maxSpeed": 0,
				"minSpeed": 0,
				"odometer": 0,
				"speed": 0,
				"startGpsTime": "",
				"startLat": 0,
				"startLon": 0,
				"vid": 0
			}
		],
		"duration": 0,
		"maxSpeed": 0,
		"minSpeed": 0,
		"odometer": 0
	},
	"msg": ""
}

## report_drive_action_overview

Driving Behavior Report
​

Endpoint /tapi/report/drive_action_day_overview

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
orgId	Organization ID	query	true	integer	
startTime	Start time	query	true	string	
zeroFilter	Filter zero data, true, others no filter	query	false	boolean	

Response Status

Status Code	Description	Schema
200	OK	R«GpsDriveActionDayOverviewVo»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsDriveActionDayOverviewVo	GpsDriveActionDayOverviewVo
msg	Return message	string	

Schema Property Description

GpsDriveActionDayOverviewVo

Parameter Name	Description	Type	Schema
details	Device driving behavior list	array	GpsDriveActionDayStatVo
deviceName	Device name	string	
fatigueDrivingSum	Total fatigue driving FATIGUE_DRIVING	integer(int32)	
harchChangeLaneSum	Total harsh lane change HARCH_CHANGE_LANE	integer(int32)	
harchTurningSum	Total harsh turning HARSH_TURNING	integer(int32)	
harshAccelerateSum	Total harsh acceleration HARSH_ACCELERATE	integer(int32)	
harshBrakingSum	Total harsh braking HARSH_BRAKING	integer(int32)	
vid	Device ID	integer(int64)	

GpsDriveActionDayStatVo

Parameter Name	Description	Type	Schema
day	Date	string	
fatigueDrivingSum	Total fatigue driving FATIGUE_DRIVING	integer(int32)	
harchChangeLaneSum	Total harsh lane change	integer(int32)	
harchTurningSum	Total harsh turning HARSH_TURNING	integer(int32)	
harshAccelerateSum	Total harsh acceleration HARSH_ACCELERATE	integer(int32)	
harshBrakingSum	Total harsh braking HARSH_BRAKING	integer(int32)	

Response Example

json
{
	"code": 0,
	"data": {
		"details": [
			{
				"day": "",
				"fatigueDrivingSum": 0,
				"harchChangeLaneSum": 0,
				"harchTurningSum": 0,
				"harshAccelerateSum": 0,
				"harshBrakingSum": 0
			}
		],
		"deviceName": "",
		"fatigueDrivingSum": 0,
		"harchChangeLaneSum": 0,
		"harchTurningSum": 0,
		"harshAccelerateSum": 0,
		"harshBrakingSum": 0,
		"vid": 0
	},
	"msg": ""
}

## report_drive_action_day_overview

Driving Behavior Report
​

Endpoint /tapi/report/drive_action_day_overview

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«GpsDriveActionDayOverviewVo»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsDriveActionDayOverviewVo	GpsDriveActionDayOverviewVo
msg	Return message	string	

Schema Property Description

GpsDriveActionDayOverviewVo

Parameter Name	Description	Type	Schema
details	Device driving behavior list	array	GpsDriveActionDayStatVo
deviceName	Device name	string	
fatigueDrivingSum	Total fatigue driving FATIGUE_DRIVING	integer(int32)	
harchChangeLaneSum	Total harsh lane change HARCH_CHANGE_LANE	integer(int32)	
harchTurningSum	Total harsh turning HARSH_TURNING	integer(int32)	
harshAccelerateSum	Total harsh acceleration HARSH_ACCELERATE	integer(int32)	
harshBrakingSum	Total harsh braking HARSH_BRAKING	integer(int32)	
vid	Device ID	integer(int64)	

GpsDriveActionDayStatVo

Parameter Name	Description	Type	Schema
day	Date	string	
fatigueDrivingSum	Total fatigue driving FATIGUE_DRIVING	integer(int32)	
harchChangeLaneSum	Total harsh lane change	integer(int32)	
harchTurningSum	Total harsh turning HARSH_TURNING	integer(int32)	
harshAccelerateSum	Total harsh acceleration HARSH_ACCELERATE	integer(int32)	
harshBrakingSum	Total harsh braking HARSH_BRAKING	integer(int32)	

Response Example

json
{
	"code": 0,
	"data": {
		"details": [
			{
				"day": "",
				"fatigueDrivingSum": 0,
				"harchChangeLaneSum": 0,
				"harchTurningSum": 0,
				"harshAccelerateSum": 0,
				"harshBrakingSum": 0
			}
		],
		"deviceName": "",
		"fatigueDrivingSum": 0,
		"harchChangeLaneSum": 0,
		"harchTurningSum": 0,
		"harshAccelerateSum": 0,
		"harshBrakingSum": 0,
		"vid": 0
	},
	"msg": ""
}

## report_drive_action_detail

Driving Behavior Detail
​

Endpoint /tapi/report/drive_action_detail

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
eventIds	Event ID list, multiple event IDs separated by ","	query	false	array	integer
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Event ID

ID	Description
43	Fatigue Driving
39	Harsh Acceleration
40	Harsh Deceleration
41	Harsh Turning
127	Harsh Lane Change

Response Status

Status Code	Description	Schema
200	OK	R«List«GpsDriveActionDetailVo»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GpsDriveActionDetailVo
msg	Return message	string	

Schema Property Description

GpsDriveActionDetailVo

Parameter Name	Description	Type	Schema
eventId	Event ID	integer(int32)	
gpsTime	GPS time	string(date-time)	
lat	Longitude	number	
lon	Latitude	number	
recTime	Receive time	string(date-time)	
speed	Speed m/hour	integer(int32)	
vid	Device ID	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"eventId": 0,
			"gpsTime": "",
			"lat": 0,
			"lon": 0,
			"recTime": "",
			"speed": 0,
			"vid": 0
		}
	],
	"msg": ""
}

## report_acc

ACC Stats
​

Endpoint /tapi/report/acc

Request Method GET

consumes ``

produces ["*/*"]

Description ACC overview

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
orgId	Organization ID	query	true	integer	
startTime	Start time	query	true	string	

Response Status

Status Code	Description	Schema
200	OK	R«GpsAccOverviewVo»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsAccOverviewVo	GpsAccOverviewVo
msg	Return message	string	

Schema Property Description

GpsAccOverviewVo

Parameter Name	Description	Type	Schema
accDeviceInfos	Device ignition details	array	GpsAccDeviceVo
accOff	ACC off duration (seconds)	integer(int32)	
accOn	ACC on duration (seconds)	integer(int32)	
deviceNum	Total number of devices	integer(int32)	

GpsAccDeviceVo

Parameter Name	Description	Type	Schema
accOff	ACC off duration (seconds)	integer(int32)	
accOn	ACC on duration (seconds)	integer(int32)	
deviceName	Device name	string	
imei	IMEI number	string	
vid	Device ID	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": {
		"accDeviceInfos": [
			{
				"accOff": 0,
				"accOn": 0,
				"deviceName": "",
				"imei": "",
				"vid": 0
			}
		],
		"accOff": 0,
		"accOn": 0,
		"deviceNum": 0
	},
	"msg": ""
}

## report_acc_detail

ACC Stats
​

Endpoint /tapi/report/acc_detail

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«GpsAccStatVo»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsAccStatVo	GpsAccStatVo
msg	Return message	string	

Schema Property Description

GpsAccStatVo

Parameter Name	Description	Type	Schema
accOff	ACC Off total duration	integer(int32)	
accOn	ACC On total duration	integer(int32)	
details	Details	array	GpsAccDetailVo
deviceName	Device name	string	
vid	Device ID	integer(int64)	

GpsAccDetailVo

Parameter Name	Description	Type	Schema
accFlag	ACC status	boolean	
deviceName	Device name	string	
duration	Total duration	integer(int32)	
endGpsTime	End time	string(date-time)	
endLat	End latitude	number	
endLon	End longitude	number	
startGpsTime	Start time	string(date-time)	
startLat	Start latitude	number	
startLon	Start longitude	number	
vid	Device ID	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": {
		"accOff": 0,
		"accOn": 0,
		"details": [
			{
				"accFlag": true,
				"deviceName": "",
				"duration": 0,
				"endGpsTime": "",
				"endLat": 0,
				"endLon": 0,
				"startGpsTime": "",
				"startLat": 0,
				"startLon": 0,
				"vid": 0
			}
		],
		"deviceName": "",
		"vid": 0
	},
	"msg": ""
}

## report_stop_acc_on

Idling Report
​

Endpoint /tapi/report/stop_acc_on

Request Method GET

consumes ``

produces ["*/*"]

Description Idling with ACC on report

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«List«GpsTripStopVo»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GpsTripStopVo
msg	Return message	string	

Schema Property Description

GpsTripStopVo

Parameter Name	Description	Type	Schema
duration	Total duration (seconds)	integer(int32)	
endGpsTime	Trip end time	string(date-time)	
lat	Longitude	number	
lon	Latitude	number	
startGpsTime	Trip start time	string(date-time)	
vid	Device ID	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"duration": 0,
			"endGpsTime": "",
			"lat": 0,
			"lon": 0,
			"startGpsTime": "",
			"vid": 0
		}
	],
	"msg": ""
}

## report_device_fuel_report

Fuel Report
​

Endpoint /tapi/report/device_fuel_report

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«GpsDeviceFuelOverviewVO»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsDeviceFuelOverviewVO	GpsDeviceFuelOverviewVO
msg	Return message	string	

Schema Property Description

GpsDeviceFuelOverviewVO

Parameter Name	Description	Type	Schema
addFuel	Refueling fuel consumption 0.1L	integer(int32)	
averageFuel	Average fuel consumption 0.1L	integer(int32)	
details	Details	array	GpsDeviceFuelVO
duration	Total running time (hours)	integer(int32)	
leakageFuel	Leakage fuel consumption 0.1L	integer(int32)	
maxSpeed	Maximum speed m/hour	integer(int32)	
odometer	Total driving mileage (meters)	integer(int32)	
useFuel	Used fuel consumption 0.1L	integer(int32)	
useFuelHour	Hourly fuel consumption 0.1L	integer(int32)	

GpsDeviceFuelVO

Parameter Name	Description	Type	Schema
accFlag	ACC status	boolean	
addFuel	Refueling unit 0.1L	integer(int32)	
fuel	Fuel quantity unit 0.1L	integer(int32)	
fuel1	Fuel quantity 1	integer(int32)	
fuel2	Fuel quantity 2	integer(int32)	
gpsTime	GPS time	string(date-time)	
lat	Latitude	number	
leakageFuel	Leakage unit 0.1L	integer(int32)	
lon	Longitude	number	
odometer	Total driving mileage (meters)	integer(int32)	
speed	Speed m/hour	integer(int32)	
useFuel	Fuel quantity unit 0.1L	integer(int32)	

Response Example

json
{
	"code": 0,
	"data": {
		"addFuel": 0,
		"averageFuel": 0,
		"details": [
			{
				"accFlag": true,
				"addFuel": 0,
				"fuel": 0,
				"fuel1": 0,
				"fuel2": 0,
				"gpsTime": "",
				"lat": 0,
				"leakageFuel": 0,
				"lon": 0,
				"odometer": 0,
				"speed": 0,
				"useFuel": 0
			}
		],
		"duration": 0,
		"leakageFuel": 0,
		"maxSpeed": 0,
		"odometer": 0,
		"useFuel": 0,
		"useFuelHour": 0
	},
	"msg": ""
}

## report_temperature_report

Temperature And Humidity Report
​

Endpoint /tapi/report/temperature_report

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«List«GpsTemperatureVO»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GpsTemperatureVO
msg	Return message	string	

Schema Property Description

GpsTemperatureVO

Parameter Name	Description	Type	Schema
gpsTime	GPS time	string(date-time)	
lat	Longitude	number	
lon	Latitude	number	
recTime	Receive time	string(date-time)	
temperatures	Temperature list	array	TemperatureVO
vid	Device ID	integer(int64)	

TemperatureVO

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	integer(int32)	
humidity	Humidity	integer(int32)	
id		string	
temperature	Temperature	integer(int32)	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"gpsTime": "",
			"lat": 0,
			"lon": 0,
			"recTime": "",
			"temperatures": [
				{
					"eleQuantity": 0,
					"humidity": 0,
					"id": "",
					"temperature": 0
				}
			],
			"vid": 0
		}
	],
	"msg": ""
}

## report_obd_data_report

OBD Report
​

Endpoint /tapi/report/obd_data_report

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«GpsObdDataOverviewVO»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsObdDataOverviewVO	GpsObdDataOverviewVO
msg	Return message	string	

Schema Property Description

GpsObdDataOverviewVO

Parameter Name	Description	Type	Schema
details	Details	array	GpsObdDataVO

GpsObdDataVO

Parameter Name	Description	Type	Schema
ambientTemp	Ambient temperature ℃	number(double)	
aps	Accelerator pedal position %	number(double)	
atmoPress	Atmospheric pressure kPa	integer(int32)	
coolantTemp	Coolant temperature ℃	number(double)	
defaultNum	Fault code count	integer(int32)	
defaultOdometer	Fault mileage (meters)	integer(int32)	
defaultStatus	Fault code status "0"=not lit, "1"=lit	integer(int32)	
deviceName	Device name	string	
engineLoad	Calculated load value %	number(double)	
fuelLevel	Remaining fuel	string	
fuelPressure	Fuel pressure kPa	integer(int32)	
gpsTime	GPS time	string(date-time)	
iaa	First cylinder ignition timing advance angle %	number(double)	
instantFuel	Instantaneous fuel consumption L/h	number(double)	
intakePressure	Intake manifold absolute pressure kPa	number(double)	
intakeTemp	Intake air temperature ℃	number(double)	
ltf	Long term fuel trim %	number(double)	
mafFlow	Mass air flow g/s	number(double)	
rpm	Engine RPM	integer(int32)	
speed	Vehicle speed m/hour	integer(int32)	
startSec	Time since engine start (seconds)	integer(int32)	
throttle	Throttle position %	number(double)	
vid	Device ID	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": {
		"details": [
			{
				"ambientTemp": 0,
				"aps": 0,
				"atmoPress": 0,
				"coolantTemp": 0,
				"defaultNum": 0,
				"defaultOdometer": 0,
				"defaultStatus": 0,
				"deviceName": "",
				"engineLoad": 0,
				"fuelLevel": "",
				"fuelPressure": 0,
				"gpsTime": "",
				"iaa": 0,
				"instantFuel": 0,
				"intakePressure": 0,
				"intakeTemp": 0,
				"ltf": 0,
				"mafFlow": 0,
				"rpm": 0,
				"speed": 0,
				"startSec": 0,
				"throttle": 0,
				"vid": 0
			}
		]
	},
	"msg": ""
}

## report_trip_fuel_overview

Trip Fuel Consumption Overview
​

Endpoint /tapi/report/trip_fuel_overview

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
orgId	Organization ID	query	true	integer	
startTime	Start time	query	true	string	

Response Status

Status Code	Description	Schema
200	OK	R«GpsTripFuelOverviewVo»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsTripFuelOverviewVo	GpsTripFuelOverviewVo
msg	Return message	string	

Schema Property Description

GpsTripFuelOverviewVo

Parameter Name	Description	Type	Schema
averageFuel	Fuel consumption per 100km 0.1L	integer(int32)	
details	Details	array	GpsTripFuelDeviceItemVo
duration	Total duration (seconds)	integer(int32)	
fuel	Fuel consumption 0.1L	integer(int32)	
odometer	Total driving mileage (meters)	integer(int32)	
tripNum	Trip count	integer(int32)	
vid	vid	integer(int64)	

GpsTripFuelDeviceItemVo

Parameter Name	Description	Type	Schema
averageFuel	Fuel consumption per 100km 0.1L	integer(int32)	
deviceName	Device name	string	
duration	Total duration (seconds)	integer(int32)	
fuel	Fuel consumption 0.1L	integer(int32)	
odometer	Total driving mileage (meters)	integer(int32)	
tripNum	Trip count	integer(int32)	
vid	Device ID	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": {
		"averageFuel": 0,
		"details": [
			{
				"averageFuel": 0,
				"deviceName": "",
				"duration": 0,
				"fuel": 0,
				"odometer": 0,
				"tripNum": 0,
				"vid": 0
			}
		],
		"duration": 0,
		"fuel": 0,
		"odometer": 0,
		"tripNum": 0,
		"vid": 0
	},
	"msg": ""
}

## report_trip_fuel_report

Trip Fuel Consumption Detail
​

Endpoint /tapi/report/trip_fuel_report

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«GpsTripFuelStatVo»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsTripFuelStatVo	GpsTripFuelStatVo
msg	Return message	string	

Schema Property Description

GpsTripFuelStatVo

Parameter Name	Description	Type	Schema
averageFuel	Fuel consumption per 100km 0.1L	integer(int32)	
details	Details	array	GpsTripFuelVo
duration	Total duration (seconds)	integer(int32)	
fuel	Fuel consumption 0.1L	integer(int32)	
odometer	Total driving mileage (meters)	integer(int32)	
tripNum	Trip count	integer(int32)	

GpsTripFuelVo

Parameter Name	Description	Type	Schema
averageFuel	Fuel consumption per 100km 0.1L	integer(int32)	
duration	Total duration (seconds)	integer(int32)	
endGpsTime	Trip end time	string(date-time)	
endLat	Trip end longitude	number(double)	
endLon	Trip end latitude	number(double)	
fuel	Fuel consumption 0.1L	integer(int32)	
odometer	Total driving mileage (meters)	integer(int32)	
startGpsTime	Trip start time	string(date-time)	
startLat	Trip start longitude	number(double)	
startLon	Trip start latitude	number(double)	
vid	Device ID	integer(int32)	

Response Example

json
{
	"code": 0,
	"data": {
		"averageFuel": 0,
		"details": [
			{
				"averageFuel": 0,
				"duration": 0,
				"endGpsTime": "",
				"endLat": 0,
				"endLon": 0,
				"fuel": 0,
				"odometer": 0,
				"startGpsTime": "",
				"startLat": 0,
				"startLon": 0,
				"vid": 0
			}
		],
		"duration": 0,
		"fuel": 0,
		"odometer": 0,
		"tripNum": 0
	},
	"msg": ""
}

## report_otc_report

DTC Report
​

Endpoint /tapi/report/otc_report

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«List«GpsObdFaultVO»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GpsObdFaultVO
msg	Return message	string	

Schema Property Description

GpsObdFaultVO

Parameter Name	Description	Type	Schema
altitude	Altitude 0.1m	number(double)	
code	Code	string	
gpsTime	GPS time	string(date-time)	
lat	Latitude	number	
lon	Longitude	number	
recTime	Receive time	string(date-time)	
speed	Speed m/second	integer(int32)	
status	Status	integer(int32)	
type	Type	string	
vid	Device ID	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"altitude": 0,
			"code": "",
			"gpsTime": "",
			"lat": 0,
			"lon": 0,
			"recTime": "",
			"speed": 0,
			"status": 0,
			"type": "",
			"vid": 0
		}
	],
	"msg": ""
}

## report_warn_overview

Alarm Overview
​

Endpoint /tapi/report/warn_overview

Request Method GET

consumes ``

produces ["*/*"]

Description Alarm overview

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
orgId	Organization ID	query	true	integer	
startTime	Start time	query	true	string	

Response Status

Status Code	Description	Schema
200	OK	R«List«GpsDeviceWarnStatVo»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GpsDeviceWarnStatVo
msg	Return message	string	

Schema Property Description

GpsDeviceWarnStatVo

Parameter Name	Description	Type	Schema
deviceName	Device name	string	
vid	Device ID	integer(int64)	
warns	Alarm ID statistics list	array	GpsWarnIdStatVo

GpsWarnIdStatVo

Parameter Name	Description	Type	Schema
num	Count	integer(int32)	
warnId	Alarm ID	integer(int32)	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"deviceName": "",
			"vid": 0,
			"warns": [
				{
					"num": 0,
					"warnId": 0
				}
			]
		}
	],
	"msg": ""
}

## report_warn_day_stat

Alarm Stats
​

Endpoint /tapi/report/warn_day_stat

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	
warnIds	Alarm types, multiple separated by ","	query	false	array	integer
zeroFilter	Filter zero data, true, others no filter	query	false	boolean	

Response Status

Status Code	Description	Schema
200	OK	R«List«GpsDeviceWarnDayItemVo»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GpsDeviceWarnDayItemVo
msg	Return message	string	

Schema Property Description

GpsDeviceWarnDayItemVo

Parameter Name	Description	Type	Schema
day	Date	string	
warns	Alarm ID statistics list	array	GpsWarnIdStatVo

GpsWarnIdStatVo

Parameter Name	Description	Type	Schema
num	Count	integer(int32)	
warnId	Alarm ID	integer(int32)	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"day": "",
			"warns": [
				{
					"num": 0,
					"warnId": 0
				}
			]
		}
	],
	"msg": ""
}

## report_warn_detail

Alarm Details
​

Endpoint /tapi/report/warn_detail

Request Method GET

consumes ``

produces ["*/*"]

Description Alarm details

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	
warnIds	Alarm types, multiple separated by ","	query	false	array	integer

Response Status

Status Code	Description	Schema
200	OK	R«List«GpsDeviceAlarmVo»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GpsDeviceAlarmVo
msg	Return message	string	

Schema Property Description

GpsDeviceAlarmVo

Parameter Name	Description	Type	Schema
deviceName	Device name	string	
gpsTime	Trip start time	string(date-time)	
lat	Latitude	number	
lon	Longitude	number	
speed	Maximum speed m/hour	integer(int32)	
vid	Device ID	integer(int64)	
warnId	Alarm ID	integer(int32)	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"deviceName": "",
			"gpsTime": "",
			"lat": 0,
			"lon": 0,
			"speed": 0,
			"vid": 0,
			"warnId": 0
		}
	],
	"msg": ""
}

## report_temperature_warn_report

T/RH Alarm Detail
​

Endpoint /tapi/report/temperature_warn_report

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	
warnId	Alarm type, only [1046,1047]	query	false	integer	

Response Status

Status Code	Description	Schema
200	OK	R«List«GpsTemperatureWarnVO»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GpsTemperatureWarnVO
msg	Return message	string	

Schema Property Description

GpsTemperatureWarnVO

Parameter Name	Description	Type	Schema
averageTemperature	Average temperature	integer(int32)	
duration	Duration	integer(int32)	
endGpsTime	End time	string(date-time)	
gpsTime	GPS time	string(date-time)	
lat		number	
lon		number	
maxTemperature	Maximum temperature	integer(int32)	
minTemperature	Minimum temperature	integer(int32)	
recTime	Receive time	string(date-time)	
vid	Device ID	integer(int64)	
warnId	Alarm ID	integer(int32)	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"averageTemperature": 0,
			"duration": 0,
			"endGpsTime": "",
			"gpsTime": "",
			"lat": 0,
			"lon": 0,
			"maxTemperature": 0,
			"minTemperature": 0,
			"recTime": "",
			"vid": 0,
			"warnId": 0
		}
	],
	"msg": ""
}

## report_photo

Image Report
​

Endpoint /tapi/report/photo

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«List«GpsPhotoVo»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	GpsPhotoVo
msg	Return message	string	

Schema Property Description

GpsPhotoVo

Parameter Name	Description	Type	Schema
cid	Channel ID	integer(int32)	
eventtype	Event type	integer(int32)	
gpsTime	GPS time	string(date-time)	
lat	Longitude	number	
lon	Latitude	number	
name	Image name	string	
photoUrl	Image URL	string	
vid	vid	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"cid": 0,
			"eventtype": 0,
			"gpsTime": "",
			"lat": 0,
			"lon": 0,
			"name": "",
			"photoUrl": "",
			"vid": 0
		}
	],
	"msg": ""
}

## update_user_password

Update User Password
​

Endpoint /dpms/user/{userId}/password

Request Method PUT

consumes ["application/json"]

produces ["*/*"]

Description Update password

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
passwordDTO	Password update DTO	body	true	PasswordDTO	PasswordDTO
userId	userId	path	true	integer	

Schema Property Description

PasswordDTO

Parameter Name	Description	Request Type	Required	Data Type	Schema
oldPassword	Old password	body	false	string	
password	Password	body	false	string	

Response Status

Status Code	Description	Schema
200	OK	R
201	Created	
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	object	
msg	Return message	string	

Response Example

json
{
	"code": 0,
	"data": {},
	"msg": ""
}

## send_verification_code

Send Forgot Password Email Verification Code
​

Endpoint /dpms/verification_code/send

Request Method GET

consumes ``

produces ["*/*"]

Description Send forgot password email verification code, the organization's corresponding email will receive a verification code

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
email	email	query	true	string	
username	username	query	true	string	

Response Status

Status Code	Description	Schema
200	OK	R
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	object	
msg	Return message	string	

Response Example

json
{
	"code": 0,
	"data": {},
	"msg": ""
}

## reset_user_password

Reset Password
​

Endpoint /dpms/verification_code/password

Request Method PUT

consumes ["application/json"]

produces ["*/*"]

Description Reset user password without the old password

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
passwordDTO	Password reset DTO	body	true	PasswordResetDTO	PasswordResetDTO

Schema Property Description

PasswordResetDTO

Parameter Name	Description	Request Type	Required	Data Type	Schema
code	Verification code	body	false	string	
password	Password	body	false	string	
username	Login username, account used for organization login	body	false	string	

Response Status

Status Code	Description	Schema
200	OK	R
201	Created	
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	object	
msg	Return message	string	

Response Example

json
{
	"code": 0,
	"data": {},
	"msg": ""
}

## update_user_time_zone

Update User Time Zone
​

Endpoint /dpms/user/{userId}/time_zone

Request Method PUT

consumes ["application/json"]

produces ["*/*"]

Description Update user time zone

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
userId	userId	path	true	integer	
userTimeZone	User time zone DTO	body	true	UserTimeZoneDTO	UserTimeZoneDTO

Schema Property Description

UserTimeZoneDTO

Parameter Name	Description	Request Type	Required	Data Type	Schema
timeZoneId	Time zone ID	body	false	integer(int64)	

Response Status

Status Code	Description	Schema
200	OK	R
201	Created	
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	object	
msg	Return message	string	

Response Example

json
{
	"code": 0,
	"data": {},
	"msg": ""
}

## update_user_avatar

Update User Avatar
​

Endpoint /dpms/user/{userId}/avatar

Request Method PUT

consumes ["multipart/form-data"]

produces ["*/*"]

Description Update user avatar

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
file	file	formData	true	file	
userId	userId	path	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R
201	Created	
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	object	
msg	Return message	string	

Response Example

json
{
	"code": 0,
	"data": {},
	"msg": ""
}

## upload_file

Upload File
​

Endpoint /dpms/file/upload

Request Method POST

consumes ["multipart/form-data"]

produces ["*/*"]

Description Upload file

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
file	file	formData	true	file	

Response Status

Status Code	Description	Schema
200	OK	R«UploadFileResultVO»
201	Created	
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	UploadFileResultVO	UploadFileResultVO
msg	Return message	string	

Schema Property Description

UploadFileResultVO

Parameter Name	Description	Type	Schema
bucketName	Bucket name	string	
fileName	File name	string	
url	File URL	string	

Response Example

json
{
	"code": 0,
	"data": {
		"bucketName": "",
		"fileName": "",
		"url": ""
	},
	"msg": ""
}

## get_file

Get File
​

Endpoint /dpms/file/{bucket}/{fileName}

Request Method GET

consumes ``

produces ["*/*"]

Description Get file

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
bucket	bucket	path	true	string	
fileName	fileName	path	true	string	

Response Status

Status Code	Description	Schema
200	OK	
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

None

Response Example

None

## get_curr_time

Get Server Time (UTC)
​

Endpoint /dpms/curr_time

Request Method GET

consumes ``

produces ["*/*"]

Description Get server time (UTC)

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	

Response Status

Status Code	Description	Schema
200	OK	R«TimeVO»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	TimeVO	TimeVO
msg	Return message	string	

Schema Property Description

TimeVO

Parameter Name	Description	Type	Schema
serverTime	Server time (UTC)	string(date-time)	

Response Example

json
{
	"code": 0,
	"data": {
		"serverTime": ""
	},
	"msg": ""
}

## get_time_zone_list

Time Zone List
​

Endpoint /dpms/sys_time_zone/list

Request Method GET

consumes ``

produces ["*/*"]

Description Time zone list

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	

Response Status

Status Code	Description	Schema
200	OK	R«List«TimeZoneVO»»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	array	TimeZoneVO
msg	Return message	string	

Schema Property Description

TimeZoneVO

Parameter Name	Description	Type	Schema
id	ID	integer(int64)	
timeZone	Time zone	string	

Response Example

json
{
	"code": 0,
	"data": [
		{
			"id": 0,
			"timeZone": ""
		}
	],
	"msg": ""
}

## get_icon_config_list

Device Icon List
​

Endpoint /dpms/device/icon_config/list

Request Method GET

consumes ``

produces ["*/*"]

Description Device icon list

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	

Response Status

Status Code	Description	Schema
200	OK	R«OrgDeviceIconSetting»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	OrgDeviceIconSetting	OrgDeviceIconSetting
msg	Return message	string	

Schema Property Description

OrgDeviceIconSetting

Parameter Name	Description	Type	Schema
icons		array	OrgDeviceIconItem

OrgDeviceIconItem

Parameter Name	Description	Type	Schema
name	Name	string	
url	URL	string	

Response Example

json
{
	"code": 0,
	"data": {
		"icons": [
			{
				"name": "",
				"url": ""
			}
		]
	},
	"msg": ""
}

## report_door_sensor_report

Bluetooth Door Magnetic Sensor
​

Endpoint /tapi/report/door_sensor_report

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«GpsDoorSensorOverviewVO»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsDoorSensorOverviewVO	GpsDoorSensorOverviewVO
msg	Return message	string	

Schema Property Description

GpsDoorSensorOverviewVO

Parameter Name	Description	Type	Schema
details	Details	array	GpsDoorSensorVO

GpsDoorSensorVO

Parameter Name	Description	Type	Schema
accFlag	ACC status	boolean	
deviceName	Device name	string	
doors	Door sensor details	array	DoorSensorDto
gpsTime	GPS time	string(date-time)	
lat	Longitude	number	
lon	Latitude	number	
speed	Speed m/hour	integer(int32)	
vid	Device ID	integer(int64)	

DoorSensorDto

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	integer(int32)	
flag	Door flag (Available values: LF,LB,RF,RB,BD)	string	
id	Bluetooth index	string	
status	Status 1: Open 0: Close	integer(int32)	

Response Example

json
{
	"code": 0,
	"data": {
		"details": [
			{
				"accFlag": true,
				"deviceName": "",
				"doors": [
					{
						"eleQuantity": 0,
						"flag": "",
						"id": "",
						"status": 0
					}
				],
				"gpsTime": "",
				"lat": 0,
				"lon": 0,
				"speed": 0,
				"vid": 0
			}
		]
	},
	"msg": ""
}

## report_alcohol_sensor_report

Bluetooth Alcohol Sensor
​

Endpoint /tapi/report/alcohol_sensor_report

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«GpsAlcoholSensorOverviewVO»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsAlcoholSensorOverviewVO	GpsAlcoholSensorOverviewVO
msg	Return message	string	

Schema Property Description

GpsAlcoholSensorOverviewVO

Parameter Name	Description	Type	Schema
details	Details	array	GpsAlcoholSensorVO

GpsAlcoholSensorVO

Parameter Name	Description	Type	Schema
accFlag	ACC status	boolean	
alcoholConcentration	Alcohol Concentration	integer(int32)	
deviceName	Device name	string	
driverName	Driver name	string	
gpsTime	GPS time	string(date-time)	
lat	Longitude	number	
lon	Latitude	number	
sensorId	Sensor ID	string	
speed	Speed m/hour	integer(int32)	
useTime	Use time	integer(int32)	
vid		integer(int64)	

Response Example

json
{
	"code": 0,
	"data": {
		"details": [
			{
				"accFlag": true,
				"alcoholConcentration": 0,
				"deviceName": "",
				"driverName": "",
				"gpsTime": "",
				"lat": 0,
				"lon": 0,
				"sensorId": "",
				"speed": 0,
				"useTime": 0,
				"vid": 0
			}
		]
	},
	"msg": ""
}

## report_heart_rate_sensor_report

Bluetooth Heart Rate Sensor
​

Endpoint /tapi/report/heart_rate_sensor_report

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«GpsHeartRateSensorOverviewVO»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsHeartRateSensorOverviewVO	GpsHeartRateSensorOverviewVO
msg	Return message	string	

Schema Property Description

GpsHeartRateSensorOverviewVO

Parameter Name	Description	Type	Schema
details	Details	array	GpsHeartRateSensorVO

GpsHeartRateSensorVO

Parameter Name	Description	Type	Schema
accFlag	ACC status	boolean	
deviceName	Device name	string	
driverName	Driver name	string	
gpsTime	GPS time	string(date-time)	
heartRate	Heart rate	integer(int32)	
imei	IMEI number	string	
lat	Longitude	number	
lon	Latitude	number	
respiratoryRate	Respiratory rate	integer(int32)	
sensorId	Sensor ID	string	
speed	Speed m/hour	integer(int32)	
vid	Device ID	integer(int64)	

Response Example

json
{
	"code": 0,
	"data": {
		"details": [
			{
				"accFlag": true,
				"deviceName": "",
				"driverName": "",
				"gpsTime": "",
				"heartRate": 0,
				"imei": "",
				"lat": 0,
				"lon": 0,
				"respiratoryRate": 0,
				"sensorId": "",
				"speed": 0,
				"vid": 0
			}
		]
	},
	"msg": ""
}

## report_speed_sensor_report

Bluetooth Speed Sensor
​

Endpoint /tapi/report/speed_sensor_report

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«GpsSpeedSensorOverviewVO»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsSpeedSensorOverviewVO	GpsSpeedSensorOverviewVO
msg	Return message	string	

Schema Property Description

GpsSpeedSensorOverviewVO

Parameter Name	Description	Type	Schema
details	Details	array	GpsSpeedSensorVO

GpsSpeedSensorVO

Parameter Name	Description	Type	Schema
accFlag	ACC status	boolean	
deviceName	Device name	string	
driverName	Driver name	string	
eleQuantity	Battery level	integer(int32)	
gpsTime	GPS time	string(date-time)	
lat	Longitude	number	
lon	Latitude	number	
odometer	Mileage (meters)	integer(int32)	
rpm	RPM 0.1rpm	integer(int32)	
sensorId	Sensor ID	string	
speed	Speed m/hour	integer(int32)	
turnFlag	true-forward, 1-reverse	boolean	
vid		integer(int64)	

Response Example

json
{
	"code": 0,
	"data": {
		"details": [
			{
				"accFlag": true,
				"deviceName": "",
				"driverName": "",
				"eleQuantity": 0,
				"gpsTime": "",
				"lat": 0,
				"lon": 0,
				"odometer": 0,
				"rpm": 0,
				"sensorId": "",
				"speed": 0,
				"turnFlag": true,
				"vid": 0
			}
		]
	},
	"msg": ""
}

## report_tire_pressure_sensor_report

Bluetooth Tire Pressure Sensor
​

Endpoint /tapi/report/tire_pressure_sensor_report

Request Method GET

consumes ``

produces ["*/*"]

Description ``

Request Parameters

Parameter Name	Description	Request Type	Required	Data Type	Schema
Accept-Language	Language eg zh-cn,en	header	false	string	
Authorization	TOKEN eg “bearer mWBURPjUOi_13oU3TDgm-ZC6EwU”	header	true	string	
endTime	End time	query	true	string	
startTime	Start time	query	true	string	
vid	Device ID	query	true	integer	

Response Status

Status Code	Description	Schema
200	OK	R«GpsTirePressureSensorOverviewVO»
401	Unauthorized	
403	Forbidden	
404	Not Found	

Response Parameters

Parameter Name	Description	Type	Schema
code	Return flag: success=0, failure=1	integer(int32)	integer(int32)
data	Data	GpsTirePressureSensorOverviewVO	GpsTirePressureSensorOverviewVO
msg	Return message	string	

Schema Property Description

GpsTirePressureSensorOverviewVO

Parameter Name	Description	Type	Schema
details	Details	array	GpsTirePressureSensorVO

GpsTirePressureSensorVO

Parameter Name	Description	Type	Schema
accFlag	ACC status	boolean	
deviceName	Device name	string	
gpsTime	GPS time	string(date-time)	
imei	IMEI number	string	
lat	Longitude	number	
lon	Latitude	number	
speed	Speed m/hour	integer(int32)	
tirePressures		array	TirePressureSensorDto
vid		integer(int64)	

TirePressureSensorDto

Parameter Name	Description	Type	Schema
eleQuantity	Battery level	integer(int32)	
id	Index	string	
pressure	Pressure: 0.1Kpa	integer(int32)	
status	Status 00 - Normal, 01 - Leakage, 02 - Inflating, 03 - Starting (tire rotating), 04 - Power on (sensor first power on)	integer(int32)	
temperature	Temperature: 0.1 degree	integer(int32)	
tireInfoId	Tire pressure ID	integer(int32)	

Response Example

json
{
	"code": 0,
	"data": {
		"details": [
			{
				"accFlag": true,
				"deviceName": "",
				"gpsTime": "",
				"lat": 0,
				"lon": 0,
				"speed": 0,
				"tirePressures": [
					{
						"eleQuantity": 0,
						"id": "",
						"pressure": 0,
						"status": 0,
						"temperature": 0,
						"tireInfoId": 0
					}
				],
				"vid": 0
			}
		]
	},
	"msg": ""
}