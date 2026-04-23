-- dbo.clin_demand_control_1_view



/* view clin_demand_control_1_view: add view */


/* view clin_demand_control_1_view: add view */


/* view clin_demand_control_1_view: add view */

/* view clin_demand_control_1_view: add view */


/* view clin_demand_control_1_view: add view */


/* view clin_demand_control_1_view: add view */


/* view clin_demand_control_1_view: add view */


/* view clin_demand_control_1_view: add view */


/* view clin_demand_control_1_view: add view */


/* view clin_demand_control_1_view: add view */
/* view clin_demand_control_1_view: add view 
 view clin_demand_control_1_view: add view 
 view clin_demand_control_1_view: add view 
 view clin_demand_control_1_view: add view 
 view clin_demand_control_1_view: add view 
 view clin_demand_control_1_view: add view 
 view clin_demand_control_1_view: add view 
 view clin_demand_control_1_view: add view */
CREATE VIEW [dbo].[clin_demand_control_1_view]
AS
SELECT        dbo.clin_basic_1_view.cntrct_k79, dbo.clin_basic_1_view.rel_no_k80, dbo.clin_basic_1_view.clinno_k81, dbo.clin_basic_1_view.prtnum_k71, dbo.clin_basic_1_view.pn_rev_k71, 
                         dbo.clin_basic_1_view.p_desc_k71, dbo.clin_basic_1_view.fsc_k08, dbo.clin_basic_1_view.niin_k08, dbo.clin_basic_1_view.idnk71_k71, dbo.clin_basic_1_view.idnk79_k79, dbo.clin_basic_1_view.idnk80_k80, 
                         dbo.clin_basic_1_view.idnk81_k81, dbo.k85_tab.idnk84_k85 AS idnk84_k84, dbo.k85_tab.idnk85_k85, dbo.clin_basic_1_view.idnk08_k08, dbo.clin_basic_1_view.piidno_k80
FROM            dbo.k85_tab INNER JOIN
                         dbo.clin_basic_1_view ON dbo.k85_tab.idnk81_k85 = dbo.clin_basic_1_view.idnk81_k81










