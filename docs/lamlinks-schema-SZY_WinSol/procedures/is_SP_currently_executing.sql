-- dbo.is_SP_currently_executing



-- exec aba_lockinfoM @restrict_to_db = 14, @calling_spid = 81

-- @processes should always be set to 2. left functionality in place for specifying 0 or 1 as well. 1 will probably 
--	never make sense since it will not list even a process id if they don't return active = 1 since i modified 
--	the routine to only look for stored procedures whihc i think will only be picked up after performing 
--	::fn_get_sql_info. therefore 2 must be used if you wnat to list non active = 1 procedures. if you determin 
--	that non ac  tive = 1 procedures are of no interest, @processes = 0 could be used.
--	will never detect a calling stored procedure because the "currently executing sp" (objid) value of the 
--	sql_handle for the spid of the calling stored procedure will always be is_SP_currently_executing

--	paramteres:
--	@processes - has to do with how "interesting" a process might be to look at, but see above to usually
--		use = 2 with the way i adapted the code
--	@find_by - could be 'objname' or 'objid', determining if search should be done by object id or name
--	@find - objid or objname, depending on how previous paramter was set
--      @use_restrict_to_db bit - 1 restricts search to a particular dbid, 0 searches al dbids
--	@restrict_to_db - dbid to restrict to if 1 was set above
--      @found_count - integer output variable used to retrun search results count


-- to find the objid of the stored procedure calling this SP to use as the @find parameter (which as mentioned above
--	will not find the calling sp itself, but will find any other executing instances of it): 
--	set @sql_handle = (select sql_handle from master.dbo.sysprocesses where spid = @@spid)
--      	SELECT objectid
--		FROM  ::fn_get_sql(@sql_handle)

-- code adapted from aba_lockinfo found at http://www.sommarskog.se/sqlutil/aba_lockinfo_sqlmm_sp3.sp
CREATE  PROCEDURE is_SP_currently_executing @processes tinyint = 2,
			      @find_by varchar(7),
			      @find varchar(200),
			      @use_restrict_to_db bit = 0,
			      @restrict_to_db int = null,
			      @found_count int = null output AS

------------------------------------------------------------------------
-- The following temp tables are work tables that are involved in dynamic
-- SQL or INSERT EXEC, and therefore cannot be table variables.
------------------------------------------------------------------------

-- Holds all object to be identified.
CREATE TABLE #objects (spid    smallint      NOT NULL,
		       dbid    smallint      NOT NULL,
                       objid   int           NOT NULL,
                       obj_full_name nvarchar(170) NULL,
                       objname nvarchar(170) NULL,
                       PRIMARY KEY CLUSTERED (spid, dbid, objid))

------------------------------------------------------------------------
-- Then table variables for locks and processes. Input from syslockinfo and
-- sysprocesses augmented with other material.
------------------------------------------------------------------------
DECLARE @procs TABLE (
   spid        smallint           NOT NULL,
   ecid        smallint           NOT NULL,
   active      bit                NOT NULL DEFAULT 1,
   login       sysname            NULL,
   command     nvarchar(16)       NULL,
   blkby       smallint           NULL,
   sql_handle  binary(20)         NOT NULL,
   current_sp  int                NULL,
   curdbid     smallint           NULL,
   PRIMARY KEY (spid, ecid))

DECLARE @locks TABLE (
   ident         int              IDENTITY,
   spid          smallint         NOT NULL,
   ecid          smallint         NOT NULL,
   activelock    bit              NOT NULL)
-- We tried indexing, but they seem to cost more than give.
--   UNIQUE NONCLUSTERED (spid, ecid, activelock, ident))
--   UNIQUE NONCLUSTERED (dbid, objid, indid, ident))

------------------------------------------------------------------------
-- Local variables.
------------------------------------------------------------------------
DECLARE @minspid     int,
        @objid       int,
        @dbid        smallint,
        @dbname      sysname,
        @qdbname     nvarchar(256),
        @stmt        varchar(8000),
        @spid        smallint,
        @sql_handle  binary(20),
        @spidstr     varchar(10),
	@f_objid     int

------------------------------------------------------------------------
-- All reads are dirty! The most important reason for this is tempdb..sysobjects.
------------------------------------------------------------------------
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED
SET NOCOUNT ON

-- Processes below @minspid are system processes.
SELECT @minspid = 50

------------------------------------------------------------------------
-- First caputure all locks. 
------------------------------------------------------------------------

INSERT @locks (spid, ecid, 
          activelock)
SELECT req_spid, req_ecid, 
     CASE WHEN rsc_type = 2 AND req_status = 1 THEN 0 ELSE 1 END
FROM   master.dbo.syslockinfo
WHERE rsc_dbid = @restrict_to_db or @use_restrict_to_db = 0
GROUP  BY req_spid, req_ecid, 
     CASE WHEN rsc_type = 2 AND req_status = 1 THEN 0 ELSE 1 END

------------------------------------------------------------------------
-- Then get the processes. We filter here for active processes once for all
------------------------------------------------------------------------
INSERT @procs(spid, ecid, login,
	      command, 
              blkby, 
              sql_handle)
   SELECT p.spid, p.ecid, coalesce(suser_sname(p.sid), p.loginame),
          rtrim(p.cmd), 
          p.blocked, 
          sql_handle
   FROM   master.dbo.sysprocesses p
   WHERE  ((p.dbid = @restrict_to_db or @use_restrict_to_db = 0) and @processes > 0) OR
          (upper(p.cmd) <> 'AWAITING COMMAND' AND
           p.spid >= @minspid AND
           p.spid <> @@spid AND
	   (p.dbid = @restrict_to_db or @use_restrict_to_db = 0)) OR
          ((p.dbid = @restrict_to_db or @use_restrict_to_db = 0) and (p.open_tran > 0 OR
          p.blocked > 0 OR
          (EXISTS (SELECT *
                   FROM   @locks l
                   WHERE  l.spid = p.spid
                     AND  l.activelock = 1) AND spid <> @@spid)))

------------------------------------------------------------------------
-- Mark inactive processes; this is only interesting if @processes = 1,
-- because with @processes = 0 we only have active now.
------------------------------------------------------------------------

IF @processes = 1
BEGIN
   UPDATE @procs
   SET    active = 0
   FROM   @procs p
   WHERE  NOT EXISTS (SELECT *
                      FROM   @locks l
                      WHERE  p.spid = l.spid
                        AND  p.ecid = l.ecid
                        AND  l.activelock = 1
                        AND  p.spid <> @@spid
                        AND  p.spid >= @minspid)
     AND  (p.command = 'AWAITING COMMAND' OR p.spid < @minspid OR p.spid = @@spid)
     AND  p.blkby = 0
END

------------------------------------------------------------------------
-- Get input buffers and fn_get_sql data. Note that only the main thread,
-- ecid = 0 is of interest.
------------------------------------------------------------------------
DECLARE C1 CURSOR LOCAL FOR
   SELECT str(spid), spid, sql_handle
   FROM   @procs
   WHERE  (@processes = 2 OR active = 1)
     AND  ecid   = 0
     AND  login IS NOT NULL
OPEN C1

WHILE 1 = 1
BEGIN
   FETCH C1 INTO @spidstr, @spid, @sql_handle
   IF @@fetch_status <> 0
      BREAK

   IF @sql_handle <> 0x0
   BEGIN
      SELECT @objid = objectid,
             @dbid  = dbid
      FROM  ::fn_get_sql(@sql_handle)
   END
   ELSE
      SELECT @objid = NULL, @dbid = NULL

   UPDATE @procs
   SET    current_sp  = @objid,
          curdbid     = @dbid
   FROM   @procs p
   WHERE  spid = @spid
     AND  ecid = 0
END

DEALLOCATE C1

------------------------------------------------------------------------
-- Get name of objects. Need to do this per database.
------------------------------------------------------------------------

INSERT #objects (spid, dbid, objid)
   SELECT spid, curdbid, current_sp
   FROM   @procs
   WHERE  curdbid > 0 AND current_sp > 0

DECLARE C2 CURSOR LOCAL FOR
   SELECT DISTINCT dbid, db_name(dbid), quotename(db_name(dbid)) FROM #objects
OPEN C2

WHILE 1 = 1
BEGIN
   FETCH C2 INTO @dbid, @dbname, @qdbname
   IF @@fetch_status <> 0
      BREAK

   -- Set database.owner.name(.index) of all objects in #objects.
   SELECT @stmt =
       ' UPDATE #objects
         SET    obj_full_name = ''' + @dbname + '.'' + u.name + ''.'' + o.name,
		objname = o.name
         FROM   #objects t
         JOIN   ' +  @qdbname + '.dbo.sysobjects o ON t.objid = o.id
         JOIN   ' +  @qdbname + '.dbo.sysusers u   ON u.uid   = o.uid
         WHERE  t.dbid = ' + str(@dbid) + '
           AND  t.objid > 0 
	   AND o.type = ''P'''
   EXEC (@stmt)
END
DEALLOCATE C2

if @find_by = 'objid'
begin
	set @f_objid = cast(@find as int)
	set @found_count = (select count(*) from #objects where objid = @f_objid)
end
else if @find_by = 'objname'
	set @found_count = (select count(*) from #objects where objname = @find)
else
	set @found_count = -1

