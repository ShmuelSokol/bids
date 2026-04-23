-- dbo.part_demand_log_1_view



/* view part_demand_log_1_view: add view */


/* view part_demand_log_1_view: add view */


/* view part_demand_log_1_view: add view */

/* view part_demand_log_1_view: add view */


/* view part_demand_log_1_view: add view */


/* view part_demand_log_1_view: add view */


/* view part_demand_log_1_view: add view */


/* view part_demand_log_1_view: add view */


/* view part_demand_log_1_view: add view */


/* view part_demand_log_1_view: add view */
/* view part_demand_log_1_view: add view 
 view part_demand_log_1_view: add view 
 view part_demand_log_1_view: add view 
 view part_demand_log_1_view: add view 
 view part_demand_log_1_view: add view 
 view part_demand_log_1_view: add view 
 view part_demand_log_1_view: add view 
 view part_demand_log_1_view: add view */
CREATE VIEW [dbo].[part_demand_log_1_view]
AS
SELECT        dbo.k86_tab.adddte_k86, dbo.k82_tab.mredes_k82, dbo.k82_tab.mrestp_k82, dbo.k83_tab.smedes_k83, dbo.k87_tab.mrtdes_k87, dbo.k82_tab.idnk82_k82, dbo.k83_tab.idnk83_k83, dbo.k84_tab.idnk84_k84, 
                         dbo.k85_tab.idnk85_k85, dbo.k86_tab.idnk86_k86, dbo.k87_tab.idnk87_k87, dbo.clin_basic_1_view.cntrct_k79, dbo.clin_basic_1_view.rel_no_k80, dbo.clin_basic_1_view.idnk79_k79, 
                         dbo.clin_basic_1_view.idnk80_k80, dbo.clin_basic_1_view.idnk81_k81, dbo.clin_basic_1_view.clinno_k81, dbo.clin_basic_1_view.pr_num_k81, dbo.clin_basic_1_view.prtnum_k71, 
                         dbo.clin_basic_1_view.pn_rev_k71, dbo.clin_basic_1_view.p_desc_k71, dbo.clin_basic_1_view.fsc_k08, dbo.clin_basic_1_view.niin_k08, dbo.clin_basic_1_view.idnk71_k71, dbo.k84_tab.idnk71_k84, 
                         dbo.k86_tab.cnq_01_k86, dbo.k86_tab.mkq_01_k86, dbo.k86_tab.rnq_01_k86, dbo.k86_tab.snq_01_k86, dbo.clin_basic_1_view.piidno_k80
FROM            dbo.k84_tab INNER JOIN
                         dbo.k85_tab ON dbo.k84_tab.idnk84_k84 = dbo.k85_tab.idnk84_k85 INNER JOIN
                         dbo.k86_tab ON dbo.k85_tab.idnk85_k85 = dbo.k86_tab.idnk85_k86 INNER JOIN
                         dbo.k83_tab INNER JOIN
                         dbo.k82_tab ON dbo.k83_tab.idnk82_k83 = dbo.k82_tab.idnk82_k82 ON dbo.k86_tab.idnk83_k86 = dbo.k83_tab.idnk83_k83 INNER JOIN
                         dbo.k87_tab ON dbo.k86_tab.idnk87_k86 = dbo.k87_tab.idnk87_k87 INNER JOIN
                         dbo.clin_basic_1_view ON dbo.k85_tab.idnk81_k85 = dbo.clin_basic_1_view.idnk81_k81










