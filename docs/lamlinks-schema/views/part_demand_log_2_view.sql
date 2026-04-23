-- dbo.part_demand_log_2_view



/* view part_demand_log_2_view: add view */


/* view part_demand_log_2_view: add view */


/* view part_demand_log_2_view: add view */

/* view part_demand_log_2_view: add view */


/* view part_demand_log_2_view: add view */


/* view part_demand_log_2_view: add view */


/* view part_demand_log_2_view: add view */


/* view part_demand_log_2_view: add view */


/* view part_demand_log_2_view: add view */


/* view part_demand_log_2_view: add view */
/* view part_demand_log_2_view: add view 
 view part_demand_log_2_view: add view 
 view part_demand_log_2_view: add view 
 view part_demand_log_2_view: add view 
 view part_demand_log_2_view: add view 
 view part_demand_log_2_view: add view 
 view part_demand_log_2_view: add view 
 view part_demand_log_2_view: add view */
CREATE VIEW [dbo].[part_demand_log_2_view]
AS
SELECT        dbo.part_demand_log_1_view.cntrct_k79, dbo.part_demand_log_1_view.rel_no_k80, dbo.part_demand_log_1_view.clinno_k81, dbo.part_demand_log_1_view.prtnum_k71 AS prtnum_dmd, 
                         dbo.part_demand_log_1_view.pn_rev_k71 AS pn_rev_dmd, dbo.part_demand_log_1_view.p_desc_k71 AS p_desc_dmd, dbo.part_demand_log_1_view.fsc_k08 AS fsc_dmd, 
                         dbo.part_demand_log_1_view.niin_k08 AS niin_dmd, dbo.part_2_view.prtnum_k71 AS prtnum_log, dbo.part_2_view.p_desc_k71 AS p_desc_log, dbo.part_2_view.fsc_k08 AS fsc_log, 
                         dbo.part_2_view.niin_k08 AS niin_log, dbo.part_demand_log_1_view.idnk71_k71 AS idnk71_dmd, dbo.part_2_view.idnk71_k71 AS idnk71_log, dbo.part_demand_log_1_view.idnk86_k86, 
                         dbo.part_demand_log_1_view.adddte_k86, dbo.part_demand_log_1_view.mredes_k82, dbo.part_demand_log_1_view.mrestp_k82, dbo.part_demand_log_1_view.smedes_k83, 
                         dbo.part_demand_log_1_view.mrtdes_k87, dbo.part_demand_log_1_view.idnk81_k81, dbo.part_demand_log_1_view.cnq_01_k86, dbo.part_demand_log_1_view.mkq_01_k86, 
                         dbo.part_demand_log_1_view.rnq_01_k86, dbo.part_demand_log_1_view.snq_01_k86, dbo.part_demand_log_1_view.idnk84_k84, dbo.part_demand_log_1_view.idnk85_k85, 
                         dbo.part_demand_log_1_view.piidno_k80
FROM            dbo.part_demand_log_1_view INNER JOIN
                         dbo.part_2_view ON dbo.part_demand_log_1_view.idnk71_k84 = dbo.part_2_view.idnk71_k71










